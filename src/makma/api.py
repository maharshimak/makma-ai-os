from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from makma.runtime import MakmaRuntime, build_runtime


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=20_000)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    tools_enabled: bool = True


def create_app(runtime: MakmaRuntime | None = None) -> FastAPI:
    runtime = runtime or build_runtime()
    app = FastAPI(
        title="Mak'ma AI OS",
        version="1.2.0",
        description=(
            "Tool-using AI runtime with persistent memory, provider routing, "
            "server-side access control and audit traces."
        ),
    )
    app.state.runtime = runtime
    app.add_middleware(
        CORSMiddleware,
        allow_origins=runtime.settings.allowed_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    async def require_auth(authorization: str | None = Header(default=None)) -> None:
        token = runtime.settings.api_token
        if token is None:
            return
        if authorization != f"Bearer {token}":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Valid bearer token required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    protected = [Depends(require_auth)]

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "version": "1.2.0",
            "provider": runtime.provider.name,
            "tools": runtime.registry.names,
            "capabilities": [
                "multi_intent_planning",
                "ranked_memory_recall",
                "execution_metrics",
                "runtime_telemetry",
                "provider_streaming",
                "server_authorized_api",
                "untrusted_tool_observations",
                "durable_failed_runs",
            ],
        }

    @app.get("/v1/tools", dependencies=protected)
    async def tools() -> list[dict[str, object]]:
        return runtime.registry.describe()

    @app.post("/v1/chat", dependencies=protected)
    async def chat(request: ChatRequest) -> dict[str, object]:
        result = await runtime.run(
            request.message,
            request.session_id,
            tools_enabled=request.tools_enabled,
        )
        return result.model_dump()

    @app.post("/v1/chat/stream", dependencies=protected)
    async def stream_chat(request: ChatRequest) -> StreamingResponse:
        async def event_stream():
            yield 'data: {"type":"run_started"}\n\n'
            async for token in runtime.stream(
                request.message,
                request.session_id,
                tools_enabled=request.tools_enabled,
            ):
                payload = json.dumps({"type": "token", "token": token})
                yield f"data: {payload}\n\n"
            yield 'data: {"type":"done"}\n\n'

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @app.get("/v1/sessions/{session_id}/history", dependencies=protected)
    async def session_history(
        session_id: str,
        limit: int = Query(default=20, ge=1, le=200),
    ) -> list[dict[str, str]]:
        history = await runtime.memory.load(session_id, limit=limit)
        return [message.model_dump() for message in history]

    @app.get("/v1/sessions/{session_id}/runs", dependencies=protected)
    async def run_history(
        session_id: str,
        limit: int = Query(default=20, ge=1, le=200),
    ) -> list[dict[str, object]]:
        runs = await runtime.memory.run_history(session_id, limit=limit)
        return [record.model_dump() for record in runs]

    @app.get("/v1/sessions/{session_id}/search", dependencies=protected)
    async def search_memory(
        session_id: str,
        q: str = Query(min_length=1, max_length=1000),
        limit: int = Query(default=5, ge=1, le=50),
    ) -> list[dict[str, str]]:
        matches = await runtime.memory.search(session_id, q, limit=limit)
        return [message.model_dump() for message in matches]

    @app.get("/v1/sessions/{session_id}/recall", dependencies=protected)
    async def recall_memory(
        session_id: str,
        q: str = Query(min_length=1, max_length=1000),
        limit: int = Query(default=5, ge=1, le=50),
    ) -> list[dict[str, object]]:
        matches = await runtime.memory.recall(session_id, q, limit=limit)
        return [match.model_dump() for match in matches]

    @app.get("/v1/telemetry", dependencies=protected)
    async def telemetry_summary(
        operation: str | None = Query(default=None, min_length=1, max_length=200),
    ) -> dict[str, object]:
        return asdict(runtime.telemetry.summarize(operation))

    return app


app = create_app()
