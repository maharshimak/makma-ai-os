import pytest

from makma.memory import SQLiteMemory


@pytest.mark.asyncio
async def test_sqlite_memory_persists_between_instances(tmp_path) -> None:
    database = tmp_path / "memory.db"
    first = SQLiteMemory(str(database))
    await first.append("session", "user", "remember blue")
    first.close()

    second = SQLiteMemory(str(database))
    history = await second.load("session")
    assert history[0].content == "remember blue"
    second.close()


@pytest.mark.asyncio
async def test_memory_search_is_session_scoped() -> None:
    memory = SQLiteMemory(":memory:")
    await memory.append("a", "user", "project atlas")
    await memory.append("b", "user", "project zeus")
    matches = await memory.search("a", "atlas")
    assert [message.content for message in matches] == ["project atlas"]
    memory.close()
