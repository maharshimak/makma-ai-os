from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

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


    if settings.eval_base_url:
        async def eval_judge(arguments: dict[str, Any], session_id: str) -> str:
            del session_id
            prompt = str(arguments["prompt"]).strip()
            output = str(arguments["output"]).strip()
            rubric = str(arguments["rubric"]).strip()
            threshold = float(arguments.get("threshold", 0.8))
            if not 0.0 <= threshold <= 1.0:
                raise ValueError("threshold must be between 0 and 1.")
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(
                    settings.eval_base_url.rstrip("/") + "/v1/judge",
                    headers=_headers(settings.eval_api_token),
                    json={
                        "prompt": prompt,
                        "output": output,
                        "rubric": rubric,
                        "threshold": threshold,
                    },
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(payload, ensure_ascii=False)

        registry.register(
            ToolDefinition(
                name="eval_judge",
                description=(
                    "Evaluate a candidate AI response against a supplied rubric through the "
                    "configured LLM Eval service. Read-only; returns score, pass/fail and reason."
                ),
                handler=eval_judge,
                risk_level="low",
                side_effects=False,
                input_schema={
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "minLength": 1, "maxLength": 20000},
                        "output": {"type": "string", "maxLength": 100000},
                        "rubric": {"type": "string", "minLength": 1, "maxLength": 20000},
                        "threshold": {"type": "number"},
                    },
                    "required": ["prompt", "output", "rubric"],
                    "additionalProperties": False,
                },
                output_schema={"type": "string"},
            )
        )

    if settings.control_plane_base_url:
        async def mlops_models(arguments: dict[str, Any], session_id: str) -> str:
            del arguments, session_id
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.get(
                    settings.control_plane_base_url.rstrip("/") + "/v1/models",
                    headers=_headers(settings.control_plane_api_token),
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(payload, ensure_ascii=False)

        async def promote_candidate(arguments: dict[str, Any], session_id: str) -> str:
            del session_id
            name = quote(str(arguments["name"]).strip(), safe="")
            version = quote(str(arguments["version"]).strip(), safe="")
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(
                    settings.control_plane_base_url.rstrip("/")
                    + f"/v1/models/{name}/{version}/candidate",
                    headers=_headers(settings.control_plane_api_token),
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(payload, ensure_ascii=False)

        async def promote_production(arguments: dict[str, Any], session_id: str) -> str:
            del session_id
            name = quote(str(arguments["name"]).strip(), safe="")
            version = quote(str(arguments["version"]).strip(), safe="")
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(
                    settings.control_plane_base_url.rstrip("/")
                    + f"/v1/models/{name}/{version}/production",
                    headers=_headers(settings.control_plane_api_token),
                )
                response.raise_for_status()
                payload = response.json()
            return json.dumps(payload, ensure_ascii=False)

        registry.register(
            ToolDefinition(
                name="mlops_models",
                description=(
                    "List models and lifecycle state from the configured MAK'MA MLOps "
                    "Control Plane. Read-only."
                ),
                handler=mlops_models,
                risk_level="low",
                side_effects=False,
                input_schema={
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                output_schema={"type": "string"},
            )
        )
        lifecycle_schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 200},
                "version": {"type": "string", "minLength": 1, "maxLength": 100},
            },
            "required": ["name", "version"],
            "additionalProperties": False,
        }
        registry.register(
            ToolDefinition(
                name="mlops_promote_candidate",
                description=(
                    "Request promotion of a registered model into candidate state. "
                    "This mutates lifecycle state and always requires explicit approval."
                ),
                handler=promote_candidate,
                requires_approval=True,
                risk_level="high",
                side_effects=True,
                input_schema=lifecycle_schema,
                output_schema={"type": "string"},
            )
        )
        registry.register(
            ToolDefinition(
                name="mlops_promote_production",
                description=(
                    "Request production promotion through the configured MLOps Control Plane. "
                    "This mutates lifecycle state and always requires explicit approval."
                ),
                handler=promote_production,
                requires_approval=True,
                risk_level="high",
                side_effects=True,
                input_schema=lifecycle_schema,
                output_schema={"type": "string"},
            )
        )
