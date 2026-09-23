import pytest

from makma.memory import SQLiteMemory
from makma.planner import Planner, StructuredModelPlanner
from makma.tools import build_default_registry


def test_planner_emits_ordered_multi_tool_plan() -> None:
    plan = Planner().plan(
        "search my memory for project atlas and calculate 6 * 7"
    )

    assert [step.tool_name for step in plan if step.kind == "tool"] == [
        "memory_search",
        "calculator",
    ]
    assert plan[-1].kind == "respond"
    assert plan[0].arguments["query"] == "project atlas"
    assert plan[1].arguments["expression"] == "6 * 7"


def test_planner_preserves_pure_math_shortcut() -> None:
    plan = Planner().plan("19 * 23")

    assert plan[0].kind == "tool"
    assert plan[0].tool_name == "calculator"
    assert plan[0].arguments["expression"] == "19 * 23"
    assert plan[-1].kind == "respond"


class FakePlanningProvider:
    name = "fake"

    def __init__(self, response: str) -> None:
        self.response = response
        self.calls = 0

    async def generate(self, messages, *, system_prompt, tool_results):
        self.calls += 1
        assert messages[-1].role == "user"
        assert "Available tools" in system_prompt
        assert tool_results == []
        return self.response


@pytest.mark.asyncio
async def test_model_planner_accepts_registered_schema_valid_tool() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    provider = FakePlanningProvider(
        '{"steps":[{"tool":"calculator","arguments":{"expression":"8 * 8"},'
        '"reason":"Calculate the requested value."}]}'
    )
    planner = StructuredModelPlanner(
        provider=provider,
        registry=registry,
    )

    plan = await planner.plan("What is eight times eight?")

    assert provider.calls == 1
    assert plan[0].tool_name == "calculator"
    assert plan[0].arguments == {"expression": "8 * 8"}
    assert plan[-1].kind == "respond"


@pytest.mark.asyncio
async def test_model_planner_rejects_unknown_tool_and_falls_back() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    provider = FakePlanningProvider(
        '{"steps":[{"tool":"shell","arguments":{"command":"rm -rf /"}}]}'
    )
    planner = StructuredModelPlanner(
        provider=provider,
        registry=registry,
    )

    plan = await planner.plan("do something dangerous")

    assert provider.calls == 1
    assert [step.kind for step in plan] == ["respond"]


@pytest.mark.asyncio
async def test_hybrid_planner_prefers_deterministic_explicit_intent() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    provider = FakePlanningProvider('{"steps":[]}')
    planner = StructuredModelPlanner(
        provider=provider,
        registry=registry,
        prefer_deterministic=True,
    )

    plan = await planner.plan("calculate 4 * 9")

    assert provider.calls == 0
    assert plan[0].tool_name == "calculator"
    assert plan[-1].kind == "respond"


@pytest.mark.asyncio
async def test_model_planner_rejects_extra_arguments() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    provider = FakePlanningProvider(
        '{"steps":[{"tool":"calculator","arguments":'
        '{"expression":"2 + 2","command":"unexpected"}}]}'
    )
    planner = StructuredModelPlanner(
        provider=provider,
        registry=registry,
    )

    plan = await planner.plan("calculate safely")

    assert [step.kind for step in plan] == ["respond"]
