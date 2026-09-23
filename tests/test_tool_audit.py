import pytest

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, build_default_registry


@pytest.mark.asyncio
async def test_tool_calls_are_persisted_with_arguments_and_results() -> None:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    runtime = MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=LocalProvider(),
        registry=registry,
        policy=PermissionPolicy(allowed_tools=frozenset(registry.names)),
    )

    result = await runtime.run("calculate 8 * 9", "audit-tools")
    records = await memory.tool_history(result.run_id)

    assert len(records) == 1
    assert records[0].tool_name == "calculator"
    assert records[0].arguments == {"expression": "8 * 9"}
    assert records[0].ok is True
    assert "72" in records[0].output
    memory.close()
