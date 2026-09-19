from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path

from makma.models import ChatMessage, RunRecord


class SQLiteMemory:
    """Persistent conversational memory and run history backed by SQLite."""

    def __init__(self, path: str) -> None:
        self.path = path
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

            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_message TEXT NOT NULL,
                response TEXT NOT NULL,
                provider TEXT NOT NULL,
                latency_ms REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_runs_session
                ON runs(session_id, created_at);
            """
        )
        self._connection.commit()

    async def append(self, session_id: str, role: str, content: str) -> None:
        async with self._lock:
            self._connection.execute(
                "INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content),
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
        rows = list(reversed(rows))
        return [ChatMessage(role=row["role"], content=row["content"]) for row in rows]

    async def search(self, session_id: str, query: str, limit: int = 5) -> list[ChatMessage]:
        pattern = f"%{query.strip()}%"
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT role, content
                FROM messages
                WHERE session_id = ? AND content LIKE ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (session_id, pattern, limit),
            ).fetchall()
        return [ChatMessage(role=row["role"], content=row["content"]) for row in rows]

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
        async with self._lock:
            self._connection.execute(
                """
                INSERT INTO runs(run_id, session_id, user_message, response, provider, latency_ms)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (run_id, session_id, user_message, response, provider, latency_ms),
            )
            self._connection.commit()

    async def run_history(self, session_id: str, limit: int = 20) -> list[RunRecord]:
        async with self._lock:
            rows = self._connection.execute(
                """
                SELECT run_id, session_id, user_message, response, provider, latency_ms, created_at
                FROM runs
                WHERE session_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [RunRecord(**dict(row)) for row in rows]

    def close(self) -> None:
        self._connection.close()
