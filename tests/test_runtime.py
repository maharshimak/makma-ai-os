import pytest

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, build_default_registry


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
