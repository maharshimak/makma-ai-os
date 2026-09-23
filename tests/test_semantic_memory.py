import pytest

from makma.memory import SQLiteMemory


class FakeSemanticEmbeddings:
    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            lowered = text.casefold()
            if "car" in lowered or "automobile" in lowered:
                vectors.append([1.0, 0.0])
            else:
                vectors.append([0.0, 1.0])
        return vectors


@pytest.mark.asyncio
async def test_semantic_recall_can_match_without_lexical_overlap() -> None:
    memory = SQLiteMemory(":memory:", embedding_provider=FakeSemanticEmbeddings())
    await memory.append("s", "user", "My automobile is parked underground.")
    await memory.append("s", "user", "The deployment region is Paris.")

    matches = await memory.recall("s", "Where is my car?", limit=2)

    assert matches
    assert matches[0].content == "My automobile is parked underground."
    memory.close()


@pytest.mark.asyncio
async def test_semantic_memory_remains_session_isolated() -> None:
    memory = SQLiteMemory(":memory:", embedding_provider=FakeSemanticEmbeddings())
    await memory.append("a", "user", "My automobile is blue.")
    await memory.append("b", "user", "My automobile is red.")

    matches = await memory.recall("a", "car")

    assert [match.content for match in matches] == ["My automobile is blue."]
    memory.close()
