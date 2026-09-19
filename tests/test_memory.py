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


@pytest.mark.asyncio
async def test_memory_recall_ranks_more_relevant_context_first() -> None:
    memory = SQLiteMemory(":memory:")
    await memory.append("a", "user", "project atlas budget is 500 euros")
    await memory.append("a", "assistant", "atlas is also a mythology reference")

    matches = await memory.recall("a", "project atlas budget", limit=5)

    assert len(matches) == 2
    assert matches[0].content == "project atlas budget is 500 euros"
    assert matches[0].score > matches[1].score
    memory.close()
