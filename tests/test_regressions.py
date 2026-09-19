import pytest

from makma.tools import PermissionPolicy, ToolDefinition, ToolRegistry, calculator


@pytest.mark.asyncio
async def test_definition_approval_is_enforced_without_policy_override():
    called = []

    async def handler(arguments, session_id):
        called.append(session_id)
        return "done"

    registry = ToolRegistry()
    registry.register(ToolDefinition("gated", "test", handler, requires_approval=True))
    policy = PermissionPolicy(frozenset({"gated"}))
    denied = await registry.execute("gated", {}, session_id="a", policy=policy)
    assert not denied.ok and not called
    allowed = await registry.execute(
        "gated", {}, session_id="a", policy=policy, approvals={"gated"}
    )
    assert allowed.ok and called == ["a"]


@pytest.mark.asyncio
@pytest.mark.parametrize("expression", ["1 / 0", "1 +", "1e309", "(-1) ** 0.5", "1e300 ** 10"])
async def test_invalid_calculations_fail_cleanly(expression):
    with pytest.raises(ValueError):
        await calculator({"expression": expression}, "a")
