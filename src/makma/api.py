from __future__ import annotations

import json
import secrets
from dataclasses import asdict

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from makma.runtime import MakmaRuntime, build_runtime
from makma.workflows import SQLiteWorkflowStore, WorkflowEngine, WorkflowSpec, WorkflowStep


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=20_000)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    tools_enabled: bool = True


class WorkflowStepRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    tool_name: str = Field(min_length=1, max_length=200)
    arguments: dict[str, object] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list, max_length=100)


class WorkflowRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    steps: list[WorkflowStepRequest] = Field(min_length=1, max_length=100)
    approvals: list[str] = Field(default_factory=list, max_length=100)


class WorkflowResumeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approvals: list[str] = Field(default_factory=list, max_length=100)


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
    workflow_store = SQLiteWorkflowStore(runtime.settings.database_path)
    workflow_engine = WorkflowEngine(
        runtime.registry,
        policy=runtime.policy,
        store=workflow_store,
    )
    app.state.workflow_engine = workflow_engine
    app.state.workflow_store = workflow_store
    app.add_middleware(
        CORSMiddleware,
        allow_origins=runtime.settings.allowed_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    async def require_auth(
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> None:
        token = runtime.settings.api_token
        if token is not None:
            scheme, _, supplied = (authorization or "").partition(" ")
            if (
                scheme.lower() != "bearer"
                or not supplied
                or not secrets.compare_digest(supplied, token)
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Valid bearer token required.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return

        client_host = request.client.host if request.client else ""
        if client_host not in {"127.0.0.1", "::1", "localhost", "testclient"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Remote access requires MAKMA_API_TOKEN.",
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
                "structured_model_planning",
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
            try:
                async for token in runtime.stream(
                    request.message,
                    request.session_id,
                    tools_enabled=request.tools_enabled,
                ):
                    payload = json.dumps({"type": "token", "token": token})
                    yield f"data: {payload}\n\n"
                yield 'data: {"type":"done"}\n\n'
            except Exception:
                payload = json.dumps(
                    {
                        "type": "error",
                        "error": "stream_failed",
                        "message": "The provider stream failed.",
                    }
                )
                yield f"data: {payload}\n\n"

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

    @app.get("/v1/runs/{run_id}/tools", dependencies=protected)
    async def run_tools(run_id: str) -> list[dict[str, object]]:
        records = await runtime.memory.tool_history(run_id)
        return [record.model_dump() for record in records]

    @app.get("/v1/telemetry", dependencies=protected)
    async def telemetry_summary(
        operation: str | None = Query(default=None, min_length=1, max_length=200),
    ) -> dict[str, object]:
        return asdict(runtime.telemetry.summarize(operation))

    @app.post("/v1/workflows/run", dependencies=protected)
    async def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
        spec = WorkflowSpec(
            name=request.name,
            steps=tuple(
                WorkflowStep(
                    id=step.id,
                    tool_name=step.tool_name,
                    arguments=step.arguments,
                    depends_on=tuple(step.depends_on),
                )
                for step in request.steps
            ),
        )
        checkpoint = await workflow_engine.start(
            spec,
            session_id=request.session_id,
            approvals=set(request.approvals),
        )
        return asdict(checkpoint)

    @app.post("/v1/workflows/{run_id}/resume", dependencies=protected)
    async def resume_workflow(
        run_id: str,
        request: WorkflowResumeRequest,
    ) -> dict[str, object]:
        try:
            checkpoint = await workflow_engine.resume(
                run_id,
                approvals=set(request.approvals),
            )
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return asdict(checkpoint)

    @app.get("/v1/workflows/{run_id}", dependencies=protected)
    async def workflow_status(run_id: str) -> dict[str, object]:
        try:
            _, checkpoint = workflow_store.load(run_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return asdict(checkpoint)

    return app


app = create_app()
