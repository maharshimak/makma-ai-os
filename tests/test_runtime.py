import pytest

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, build_default_registry


def make_runtime() -> MakmaRuntime:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    return MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=LocalProvider(),
        registry=registry,
        policy=PermissionPolicy(allowed_tools=frozenset(registry.names)),
    )


@pytest.mark.asyncio
async def test_runtime_executes_planned_calculator_tool() -> None:
    runtime = make_runtime()
    result = await runtime.run("calculate 12 * 7", "math")
    assert result.tool_results[0].ok
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
