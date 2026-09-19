import pytest

from makma.memory import SQLiteMemory
from makma.tools import PermissionPolicy, build_default_registry


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
