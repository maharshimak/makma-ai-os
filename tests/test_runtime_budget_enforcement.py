import pytest

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.reliability import BudgetExceeded, ExecutionBudget
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, build_default_registry


def make_budgeted_runtime(max_tool_calls: int) -> MakmaRuntime:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    return MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=LocalProvider(),
        registry=registry,
        policy=PermissionPolicy(allowed_tools=frozenset(registry.names)),
        execution_budget=ExecutionBudget(
            max_steps=10,
            max_tool_calls=max_tool_calls,
            max_model_calls=2,
            max_cost_usd=1.0,
            max_elapsed_ms=30_000,
        ),
    )


@pytest.mark.asyncio
async def test_runtime_enforces_tool_call_budget_and_audits_failure() -> None:
    runtime = make_budgeted_runtime(max_tool_calls=1)
    await runtime.memory.append("budget", "user", "project atlas budget is 500 euros")

    with pytest.raises(BudgetExceeded, match="tool-call budget"):
        await runtime.run(
            "search my memory for project atlas and calculate 6 * 7",
            "budget",
        )

    runs = await runtime.memory.run_history("budget")
    assert runs[0].status == "failed"
    assert "BudgetExceeded" in (runs[0].error or "")


@pytest.mark.asyncio
async def test_runtime_succeeds_when_plan_fits_budget() -> None:
    runtime = make_budgeted_runtime(max_tool_calls=2)
    result = await runtime.run("calculate 9 * 9", "within-budget")

    assert result.tool_results[0].ok
    assert "81" in result.response



class ExplodingPlanner:
    def plan(self, message: str):
        raise RuntimeError("planner exploded")


@pytest.mark.asyncio
async def test_stream_planner_failure_is_persisted_as_failed_run() -> None:
    runtime = make_budgeted_runtime(max_tool_calls=2)
    runtime.planner = ExplodingPlanner()

    with pytest.raises(RuntimeError, match="planner exploded"):
        async for _ in runtime.stream("hello", "stream-plan-failure"):
            pass

    runs = await runtime.memory.run_history("stream-plan-failure")
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "planner exploded" in (runs[0].error or "")
