import pytest

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.models import PlanStep
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import (
    PermissionPolicy,
    ToolDefinition,
    ToolRegistry,
    build_default_registry,
)


def make_runtime(provider=None) -> MakmaRuntime:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    return MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=provider or LocalProvider(),
        registry=registry,
        policy=PermissionPolicy(allowed_tools=frozenset(registry.names)),
    )


@pytest.mark.asyncio
async def test_runtime_executes_planned_calculator_tool() -> None:
    runtime = make_runtime()
    result = await runtime.run("calculate 12 * 7", "math")
    assert result.tool_results[0].ok
    assert result.tool_results[0].trusted is False
    assert "84" in result.response
    history = await runtime.memory.load("math")
    assert [message.role for message in history] == ["user", "assistant"]


@pytest.mark.asyncio
async def test_runtime_records_auditable_run() -> None:
    runtime = make_runtime()
    result = await runtime.run("hello", "audit")
    runs = await runtime.memory.run_history("audit")
    assert runs[0].run_id == result.run_id
    assert runs[0].provider == "local"
    assert runs[0].status == "succeeded"
    assert runs[0].error is None


@pytest.mark.asyncio
async def test_runtime_executes_multiple_explicit_tool_intents_in_order() -> None:
    runtime = make_runtime()
    await runtime.memory.append("multi", "user", "project atlas budget is 500 euros")

    result = await runtime.run(
        "search my memory for project atlas and calculate 6 * 7",
        "multi",
    )

    assert [item.tool_name for item in result.tool_results] == [
        "memory_search",
        "calculator",
    ]
    assert all(item.ok for item in result.tool_results)
    assert result.metrics.tool_calls == 2
    assert result.metrics.successful_tool_calls == 2
    assert "42" in result.response


@pytest.mark.asyncio
async def test_memory_tool_does_not_retrieve_current_search_prompt() -> None:
    runtime = make_runtime()
    await runtime.memory.append("recall", "user", "remember project orion launch date")

    result = await runtime.run("search my memory for project orion", "recall")

    assert result.tool_results[0].ok
    assert "remember project orion launch date" in result.tool_results[0].output
    assert "search my memory for project orion" not in result.tool_results[0].output


@pytest.mark.asyncio
async def test_stream_uses_provider_stream_instead_of_word_replay() -> None:
    runtime = make_runtime()
    chunks = [chunk async for chunk in runtime.stream("hello", "stream")]
    assert chunks == ["Mak'ma AI OS is online. I received: hello"]
    runs = await runtime.memory.run_history("stream")
    assert runs[0].status == "succeeded"


class BrokenProvider(LocalProvider):
    name = "broken"

    async def generate(self, messages, *, system_prompt, tool_results):
        raise RuntimeError("provider exploded")


@pytest.mark.asyncio
async def test_provider_failure_is_persisted_as_failed_run() -> None:
    runtime = make_runtime(BrokenProvider())
    with pytest.raises(RuntimeError, match="provider exploded"):
        await runtime.run("hello", "failed-run")

    runs = await runtime.memory.run_history("failed-run")
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "RuntimeError" in (runs[0].error or "")



class GatedPlanner:
    def plan(self, message: str) -> list[PlanStep]:
        del message
        return [
            PlanStep(
                id="gated-step",
                kind="tool",
                description="Execute a gated synthetic tool.",
                tool_name="gated",
                arguments={"target": "synthetic-resource"},
            ),
            PlanStep(
                id="respond-step",
                kind="respond",
                description="Respond after the gated tool attempt.",
            ),
        ]


@pytest.mark.asyncio
async def test_server_approval_is_argument_bound_and_one_time() -> None:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = ToolRegistry()
    calls: list[str] = []

    async def gated_handler(arguments, session_id):
        calls.append(f"{session_id}:{arguments['target']}")
        return "synthetic action completed"

    registry.register(
        ToolDefinition(
            name="gated",
            description="Synthetic high-risk action used only by the regression test.",
            handler=gated_handler,
            requires_approval=True,
            risk_level="high",
            side_effects=True,
        )
    )
    runtime = MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=LocalProvider(),
        registry=registry,
        planner=GatedPlanner(),
        policy=PermissionPolicy(allowed_tools=frozenset({"gated"})),
    )

    first = await runtime.run("perform gated action", "approval-session")
    assert not first.tool_results[0].ok
    assert "Server approval required" in (first.tool_results[0].error or "")
    assert calls == []

    challenges = await memory.list_approval_challenges("approval-session")
    assert len(challenges) == 1
    assert challenges[0].status == "pending"

    approved = await memory.approve_challenge(challenges[0].id)
    assert approved.status == "approved"

    second = await runtime.run("perform gated action", "approval-session")
    assert second.tool_results[0].ok
    assert calls == ["approval-session:synthetic-resource"]

    consumed = await memory.list_approval_challenges("approval-session")
    assert consumed[0].status == "consumed"

    third = await runtime.run("perform gated action", "approval-session")
    assert not third.tool_results[0].ok
    assert calls == ["approval-session:synthetic-resource"]
    latest = await memory.list_approval_challenges("approval-session")
    assert latest[0].status == "pending"


@pytest.mark.asyncio
async def test_tool_execution_persists_digest_only_audit_metadata() -> None:
    runtime = make_runtime()
    result = await runtime.run("calculate 12 * 7", "tool-audit")

    records = await runtime.memory.tool_history(result.run_id)

    assert len(records) == 1
    record = records[0]
    assert record.tool_name == "calculator"
    assert record.plan_step_id == result.plan[0].id
    assert record.ok is True
    assert len(record.arguments_sha256) == 64
    assert len(record.result_sha256) == 64
    assert "12 * 7" not in record.arguments_sha256
