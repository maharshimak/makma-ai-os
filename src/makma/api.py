from __future__ import annotations

import json
import secrets
from dataclasses import asdict

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from makma import contracts
from makma.runtime import MakmaRuntime, build_runtime
from makma.specialists import SpecialistRegistry
from makma.tools import PermissionPolicy
from makma.workflows import (
    ApprovalError,
    IllegalTransition,
    SQLiteWorkflowStore,
    WorkflowBusy,
    WorkflowCheckpoint,
    WorkflowEngine,
    WorkflowSpec,
    WorkflowStep,
    WorkflowValidationError,
)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=20_000)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    tools_enabled: bool = True


class WorkflowStepRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    tool_name: str = Field(default="", max_length=200)
    specialist: str | None = Field(default=None, max_length=64)
    operation: str | None = Field(default=None, max_length=64)
    arguments: dict[str, object] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list, max_length=100)
    retryable: bool = False
    max_attempts: int = Field(default=1, ge=1, le=10)
    timeout_s: float | None = Field(default=None, gt=0, le=3600)
    requires_approval: bool = False


class WorkflowRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    steps: list[WorkflowStepRequest] = Field(min_length=1, max_length=100)
    input_schema: dict[str, object] | None = None
    inputs: dict[str, object] = Field(default_factory=dict)
    correlation_id: str | None = Field(default=None, min_length=1, max_length=128)
    # Can only narrow the server policy; never widen it.
    permissions: list[str] | None = Field(default=None, max_length=200)


async def _checkpoint_response(operation) -> dict[str, object]:
    try:
        checkpoint: WorkflowCheckpoint = await operation
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except WorkflowValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ApprovalError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except (IllegalTransition, WorkflowBusy) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return asdict(checkpoint)


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
    specialists = SpecialistRegistry.from_env()
    # Specialist operations are denied unless explicitly allow-listed (least privilege).
    workflow_policy = PermissionPolicy(
        allowed_tools=runtime.policy.allowed_tools
        | runtime.settings.workflow_specialist_actions,
        approval_required_tools=runtime.policy.approval_required_tools,
    )
    workflow_engine = WorkflowEngine(
        runtime.registry,
        policy=workflow_policy,
        store=workflow_store,
        specialists=specialists,
    )
    app.state.specialists = specialists
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
        host_header = request.headers.get("host", "").casefold()
        local_host = (
            host_header in {"localhost", "127.0.0.1", "[::1]", "testserver"}
            or host_header.startswith(("localhost:", "127.0.0.1:", "[::1]:"))
        )
        if (
            client_host not in {"127.0.0.1", "::1", "localhost", "testclient"}
            or not local_host
        ):
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
                    specialist=step.specialist,
                    operation=step.operation,
                    retryable=step.retryable,
                    max_attempts=step.max_attempts,
                    timeout_s=step.timeout_s,
                    requires_approval=step.requires_approval,
                )
                for step in request.steps
            ),
            input_schema=request.input_schema,
            permissions=(
                frozenset(request.permissions) if request.permissions is not None else None
            ),
        )
        return await _checkpoint_response(
            workflow_engine.start(
                spec,
                session_id=request.session_id,
                inputs=request.inputs,
                correlation_id=request.correlation_id,
            )
        )

    @app.post("/v1/workflows/{run_id}/resume", dependencies=protected)
    async def resume_workflow(run_id: str) -> dict[str, object]:
        """Resume only non-privileged work. Client requests cannot grant approvals."""
        return await _checkpoint_response(workflow_engine.resume(run_id))

    @app.post("/v1/workflows/{run_id}/recover", dependencies=protected)
    async def recover_workflow(run_id: str) -> dict[str, object]:
        """Continue a run interrupted by a crash. Never grants approvals."""
        return await _checkpoint_response(workflow_engine.recover(run_id))

    @app.post("/v1/workflows/{run_id}/cancel", dependencies=protected)
    async def cancel_workflow(run_id: str) -> dict[str, object]:
        return await _checkpoint_response(workflow_engine.cancel(run_id))

    @app.get("/v1/workflows/{run_id}/trace", dependencies=protected)
    async def workflow_trace(run_id: str) -> list[dict[str, object]]:
        try:
            workflow_store.load(run_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return workflow_engine.trace(run_id)

    @app.get("/v1/specialists", dependencies=protected)
    async def specialist_status() -> list[dict[str, object]]:
        """Live availability of every specialist; unconfigured ones report 'unavailable'."""
        return await specialists.status()

    @app.get("/v1/capabilities", dependencies=protected)
    async def makma_capabilities() -> dict[str, object]:
        return contracts.capabilities()

    @app.post("/v1/ops/{operation}", dependencies=protected)
    async def makma_operation(
        operation: str,
        request: Request,
        run_id: str | None = Header(default=None, alias="X-Makma-Run-Id"),
        correlation_id: str | None = Header(default=None, alias="X-Makma-Correlation-Id"),
    ) -> JSONResponse:
        try:
            payload = await request.json()
        except ValueError:
            payload = None  # run_operation answers with an INVALID_INPUT envelope
        envelope = contracts.run_operation(
            operation, payload, run_id=run_id, correlation_id=correlation_id
        )
        code = (envelope.get("error") or {}).get("code")
        status_code = {"UNKNOWN_OPERATION": 404, "INVALID_INPUT": 422}.get(
            code, 200 if envelope["status"] == "ok" else 500
        )
        return JSONResponse(envelope, status_code=status_code)

    @app.post("/v1/workflows/{run_id}/approve", dependencies=protected)
    async def approve_workflow_step(
        run_id: str,
        approval_token: str | None = Header(
            default=None,
            alias="X-Makma-Approval-Token",
        ),
    ) -> dict[str, object]:
        """Approve exactly the currently paused step with a separate credential."""
        configured = runtime.settings.approval_token
        if not configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MAKMA_APPROVAL_TOKEN is required for privileged workflow approval.",
            )
        if not approval_token or not secrets.compare_digest(approval_token, configured):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Valid workflow approval token required.",
            )
        try:
            spec, checkpoint = workflow_store.load(run_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        if checkpoint.status != "paused" or checkpoint.pending_step is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Workflow is not waiting for an approval.",
            )
        pending = next(
            (step for step in spec.steps if step.id == checkpoint.pending_step),
            None,
        )
        if pending is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Pending workflow step is missing from the persisted specification.",
            )
        return await _checkpoint_response(
            workflow_engine.resume(
                run_id,
                approved_steps={pending.id},
                approver="approval-token-holder",
            )
        )

    @app.get("/v1/workflows/{run_id}", dependencies=protected)
    async def workflow_status(run_id: str) -> dict[str, object]:
        try:
            _, checkpoint = workflow_store.load(run_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return asdict(checkpoint)

    return app


app = create_app()
