from __future__ import annotations

import asyncio
import json
import re
import sqlite3
from pathlib import Path

from makma.memory_embeddings import MemoryEmbeddingProvider, cosine_similarity
from makma.models import ChatMessage, MemoryMatch, RunRecord, ToolCallRecord

_TOKEN_RE = re.compile(r"\w+", flags=re.UNICODE)


def _tokens(text: str) -> set[str]:
    return {token.casefold() for token in _TOKEN_RE.findall(text) if token}


class SQLiteMemory:
    """Persistent conversational memory and durable run history backed by SQLite."""

    def __init__(
        self,
        path: str,
        embedding_provider: MemoryEmbeddingProvider | None = None,
    ) -> None:
        self.path = path
        self.embedding_provider = embedding_provider
        if path != ":memory:":
            Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = asyncio.Lock()
        self._initialize()

    def _initialize(self) -> None:
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_messages_session
                ON messages(session_id, id);

            CREATE TABLE IF NOT EXISTS message_embeddings (
                message_id INTEGER PRIMARY KEY,
                vector_json TEXT NOT NULL,
                FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_message TEXT NOT NULL,
                response TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL,
                latency_ms REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'succeeded',
                error TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_runs_session
                ON runs(session_id, created_at);

            CREATE TABLE IF NOT EXISTS tool_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                step_id TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                arguments_json TEXT NOT NULL,
                ok INTEGER NOT NULL,
                output TEXT NOT NULL DEFAULT '',
                error TEXT,
                latency_ms REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(run_id) REFERENCES runs(run_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_tool_calls_run
                ON tool_calls(run_id, id);
            """
        )
        self._ensure_column("runs", "status", "TEXT NOT NULL DEFAULT 'succeeded'")
        self._ensure_column("runs", "error", "TEXT")
        self._ensure_column("runs", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
        self._connection.commit()

    def _ensure_column(self, table: str, column: str, definition: str) -> None:
        columns = {
            str(row["name"])
            for row in self._connection.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if column not in columns:
            self._connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    async def _embed_one(self, text: str) -> list[float] | None:
        if self.embedding_provider is None:
            return None
        vectors = await asyncio.to_thread(self.embedding_provider.embed, [text])
        if len(vectors) != 1 or not vectors[0]:
            raise ValueError("Memory embedding provider returned an invalid result.")
        return [float(value) for value in vectors[0]]

    async def append(self, session_id: str, role: str, content: str) -> None:
        vector = await self._embed_one(content)
        async with self._lock:
            cursor = self._connection.execute(
                "INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content),
            )
            if vector is not None:
                self._connection.execute(
                    "INSERT INTO message_embeddings(message_id, vector_json) VALUES (?, ?)",
                    (cursor.lastrowid, json.dumps(vector, separators=(",", ":"))),
                )
            self._connection.commit()

    async def load(self, session_id: str, limit: int = 20) -> list[ChatMessage]:
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT role, content
                FROM messages
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [
            ChatMessage(role=row["role"], content=row["content"])
            for row in reversed(rows)
        ]

    async def recall(
        self,
        session_id: str,
        query: str,
        limit: int = 5,
        *,
        candidate_limit: int = 500,
    ) -> list[MemoryMatch]:
        """Return hybrid lexical/semantic memories with strict session isolation."""

        normalized_query = query.strip().casefold()
        if not normalized_query:
            return []
        if limit <= 0 or candidate_limit <= 0:
            raise ValueError("Memory recall limits must be positive.")

        query_tokens = _tokens(normalized_query)
        query_vector = await self._embed_one(query)
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT m.role, m.content, m.created_at, e.vector_json
                FROM messages AS m
                LEFT JOIN message_embeddings AS e ON e.message_id = m.id
                WHERE m.session_id = ?
                ORDER BY m.id DESC
                LIMIT ?
                """,
                (session_id, candidate_limit),
            ).fetchall()

        ranked: list[MemoryMatch] = []
        for recency_rank, row in enumerate(rows):
            content = str(row["content"])
            normalized_content = content.casefold()
            content_tokens = _tokens(normalized_content)
            overlap = query_tokens & content_tokens
            phrase_match = normalized_query in normalized_content

            semantic_score = 0.0
            if query_vector is not None and row["vector_json"]:
                try:
                    stored_vector = [float(value) for value in json.loads(row["vector_json"])]
                    semantic_score = max(0.0, cosine_similarity(query_vector, stored_vector))
                except (TypeError, ValueError, json.JSONDecodeError):
                    semantic_score = 0.0

            if not phrase_match and not overlap and semantic_score < 0.35:
                continue

            coverage = len(overlap) / max(len(query_tokens), 1)
            phrase_bonus = 1.0 if phrase_match else 0.0
            provenance_bonus = 0.25 if row["role"] == "user" else 0.0
            recency_bonus = 0.15 / (recency_rank + 1)
            semantic_bonus = 0.75 * semantic_score
            score = phrase_bonus + coverage + provenance_bonus + recency_bonus + semantic_bonus
            ranked.append(
                MemoryMatch(
                    role=row["role"],
                    content=content,
                    score=round(score, 6),
                    created_at=row["created_at"],
                )
            )

        ranked.sort(key=lambda match: match.score, reverse=True)
        return ranked[:limit]

    async def search(self, session_id: str, query: str, limit: int = 5) -> list[ChatMessage]:
        matches = await self.recall(session_id, query, limit=limit)
        return [ChatMessage(role=match.role, content=match.content) for match in matches]

    async def start_run(
        self,
        *,
        run_id: str,
        session_id: str,
        user_message: str,
        provider: str,
    ) -> None:
        async with self._lock:
            self._connection.execute(
                """
                INSERT INTO runs(
                    run_id, session_id, user_message, response, provider,
                    latency_ms, status, error
                )
                VALUES (?, ?, ?, '', ?, 0, 'running', NULL)
                """,
                (run_id, session_id, user_message, provider),
            )
            self._connection.commit()

    async def finish_run(
        self,
        run_id: str,
        *,
        response: str,
        latency_ms: float,
        status: str,
        error: str | None = None,
    ) -> None:
        if status not in {"succeeded", "failed"}:
            raise ValueError("Run status must be succeeded or failed.")
        async with self._lock:
            cursor = self._connection.execute(
                """
                UPDATE runs
                SET response = ?, latency_ms = ?, status = ?, error = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE run_id = ?
                """,
                (response, latency_ms, status, error, run_id),
            )
            if cursor.rowcount != 1:
                raise KeyError(f"Unknown run: {run_id}")
            self._connection.commit()

    async def record_run(
        self,
        *,
        run_id: str,
        session_id: str,
        user_message: str,
        response: str,
        provider: str,
        latency_ms: float,
    ) -> None:
        """Backward-compatible helper for callers that already have a finished run."""
        await self.start_run(
            run_id=run_id,
            session_id=session_id,
            user_message=user_message,
            provider=provider,
        )
        await self.finish_run(
            run_id,
            response=response,
            latency_ms=latency_ms,
            status="succeeded",
        )

    async def record_tool_call(
        self,
        *,
        run_id: str,
        step_id: str,
        tool_name: str,
        arguments: dict[str, object],
        ok: bool,
        output: str,
        error: str | None,
        latency_ms: float,
    ) -> None:
        if latency_ms < 0:
            raise ValueError("Tool latency must be non-negative.")
        async with self._lock:
            exists = self._connection.execute(
                "SELECT 1 FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if exists is None:
                raise KeyError(f"Unknown run: {run_id}")
            self._connection.execute(
                """
                INSERT INTO tool_calls(
                    run_id, step_id, tool_name, arguments_json,
                    ok, output, error, latency_ms
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    step_id,
                    tool_name,
                    json.dumps(arguments, sort_keys=True, separators=(",", ":"), ensure_ascii=False),
                    int(ok),
                    output,
                    error,
                    latency_ms,
                ),
            )
            self._connection.commit()

    async def tool_history(self, run_id: str) -> list[ToolCallRecord]:
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT run_id, step_id, tool_name, arguments_json, ok,
                       output, error, latency_ms, created_at
                FROM tool_calls
                WHERE run_id = ?
                ORDER BY id ASC
                """,
                (run_id,),
            ).fetchall()
        return [
            ToolCallRecord(
                run_id=row["run_id"],
                step_id=row["step_id"],
                tool_name=row["tool_name"],
                arguments=json.loads(row["arguments_json"]),
                ok=bool(row["ok"]),
                output=row["output"],
                error=row["error"],
                latency_ms=row["latency_ms"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def run_history(self, session_id: str, limit: int = 20) -> list[RunRecord]:
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT run_id, session_id, user_message, response, provider, latency_ms,
                       status, error, created_at, updated_at
                FROM runs
                WHERE session_id = ?
                ORDER BY created_at DESC, rowid DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [RunRecord(**dict(row)) for row in rows]

    def close(self) -> None:
        self._connection.close()
