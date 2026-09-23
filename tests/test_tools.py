import pytest

from makma.memory import SQLiteMemory
from makma.tools import PermissionPolicy, ToolDefinition, ToolRegistry, build_default_registry


@pytest.mark.asyncio
async def test_calculator_executes_safe_math() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    result = await registry.execute(
        "calculator",
        {"expression": "2 + 3 * 4"},
        session_id="demo",
        policy=PermissionPolicy(allowed_tools=frozenset({"calculator"})),
    )
    assert result.ok
    assert result.output == "2 + 3 * 4 = 14"
    assert result.trusted is False
    assert result.provenance == "tool:calculator"
    memory.close()


@pytest.mark.asyncio
async def test_permission_policy_blocks_disallowed_tool() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    result = await registry.execute(
        "calculator",
        {"expression": "2 + 2"},
        session_id="demo",
        policy=PermissionPolicy(allowed_tools=frozenset()),
    )
    assert not result.ok
    assert "not allowed" in (result.error or "")
    memory.close()


def test_tool_descriptions_expose_security_and_schema_metadata() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    tools = {item["name"]: item for item in registry.describe()}
    calculator = tools["calculator"]
    assert calculator["risk_level"] == "low"
    assert calculator["side_effects"] is False
    assert calculator["input_schema"]["required"] == ["expression"]
    memory.close()


@pytest.mark.asyncio
async def test_tool_schema_rejects_extra_and_wrong_type_arguments() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    policy = PermissionPolicy(allowed_tools=frozenset(registry.names))

    extra = await registry.execute(
        "calculator",
        {"expression": "2 + 2", "unexpected": "x"},
        session_id="demo",
        policy=policy,
    )
    wrong_type = await registry.execute(
        "calculator",
        {"expression": 42},
        session_id="demo",
        policy=policy,
    )

    assert not extra.ok
    assert "Unexpected tool arguments" in (extra.error or "")
    assert not wrong_type.ok
    assert "must be a string" in (wrong_type.error or "")
    memory.close()



@pytest.mark.asyncio
async def test_high_risk_or_side_effecting_tools_require_approval() -> None:
    async def mutate(arguments, session_id):
        del arguments, session_id
        return "changed"

    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="dangerous",
            description="Synthetic side-effecting test tool.",
            handler=mutate,
            risk_level="high",
            side_effects=True,
        )
    )
    policy = PermissionPolicy(allowed_tools=frozenset({"dangerous"}))

    blocked = await registry.execute(
        "dangerous",
        {},
        session_id="demo",
        policy=policy,
    )
    approved = await registry.execute(
        "dangerous",
        {},
        session_id="demo",
        policy=policy,
        approvals={"dangerous"},
    )

    assert not blocked.ok
    assert "requires explicit approval" in (blocked.error or "")
    assert approved.ok
    assert approved.output == "changed"
