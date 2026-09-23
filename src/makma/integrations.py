from __future__ import annotations

import json
from typing import Any

import httpx

from makma.config import Settings
from makma.tools import ToolDefinition, ToolRegistry


def _headers(token: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"} if token else {}


def register_http_integrations(registry: ToolRegistry, settings: Settings) -> None:
    """Register configured read-only MAK'MA satellite services as tools."""

    if settings.rag_base_url:
        async def rag_answer(arguments: dict[str, Any], session_id: str) -> str:
            del session_id
            query = str(arguments["query"]).strip()
            top_k = int(arguments.get("top_k", 5))
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(
                    settings.rag_base_url.rstrip("/") + "/v1/answer",
                    headers=_headers(settings.rag_api_token),
                    json={"query": query, "top_k": top_k},
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(
                {
                    "answer": payload.get("answer"),
                    "citations": payload.get("citations", []),
                    "trace": payload.get("trace", {}),
                },
                ensure_ascii=False,
            )

        registry.register(
            ToolDefinition(
                name="rag_answer",
                description=(
                    "Answer a question using the configured Agentic RAG Engine. "
                    "This is retrieval/read-only and returns citations plus retrieval "
                    "trace metadata."
                ),
                handler=rag_answer,
                risk_level="low",
                side_effects=False,
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "minLength": 1, "maxLength": 4000},
                        "top_k": {"type": "integer"},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
                output_schema={"type": "string"},
            )
        )

    if settings.data_copilot_base_url:
        async def data_ask(arguments: dict[str, Any], session_id: str) -> str:
            del session_id
            question = str(arguments["question"]).strip()
            max_rows = int(arguments.get("max_rows", 100))
            if not 1 <= max_rows <= 1000:
                raise ValueError("max_rows must be between 1 and 1000.")
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(
                    settings.data_copilot_base_url.rstrip("/") + "/v1/ask",
                    headers=_headers(settings.data_copilot_api_token),
                    json={"question": question, "max_rows": max_rows},
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(
                {
                    "plan": payload.get("plan", {}),
                    "rows": payload.get("rows", []),
                    "audit": payload.get("audit", {}),
                    "insights": payload.get("insights", {}),
                },
                ensure_ascii=False,
            )

        registry.register(
            ToolDefinition(
                name="data_ask",
                description=(
                    "Ask the configured Secure Data Copilot a read-only analytical question. "
                    "The downstream service must enforce its SQL AST and database "
                    "read-only policies."
                ),
                handler=data_ask,
                risk_level="medium",
                side_effects=False,
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "minLength": 1, "maxLength": 4000},
                        "max_rows": {"type": "integer"},
                    },
                    "required": ["question"],
                    "additionalProperties": False,
                },
                output_schema={"type": "string"},
            )
        )
