from __future__ import annotations

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from makma.api import create_app
from makma.config import Settings
from makma.contracts import contract_schema
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, ToolDefinition, build_default_registry


def client(*, api_token: str | None = None, approval_token: str | None = None,
           allowlist: str = "") -> TestClient:
    settings = Settings(database_path=":memory:", provider="local", api_token=api_token,
                        approval_token=approval_token, workflow_specialist_allowlist=allowlist)
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)

    async def publish(arguments, session_id):
        return f"published:{arguments['text']}"

    registry.register(ToolDefinition("publish", "side effect", publish, side_effects=True,
                                     input_schema={"type": "object", "required": ["text"],
                                                   "properties": {"text": {"type": "string"}}}))
    runtime = MakmaRuntime(settings=settings, memory=memory, provider=LocalProvider(),
                           registry=registry,
                           policy=PermissionPolicy(allowed_tools=frozenset(registry.names)))
    return TestClient(create_app(runtime))


def test_ops_routes_return_schema_valid_envelopes_and_require_auth():
    api = client(api_token="secret")
    assert api.get("/v1/capabilities").status_code == 401
    assert api.post("/v1/ops/calculate", json={"expression": "1+1"}).status_code == 401
    headers = {"Authorization": "Bearer secret"}
    caps = api.get("/v1/capabilities", headers=headers).json()
    assert caps["system"] == "makma-ai-os"
    validator = Draft202012Validator(contract_schema())
    cases = [
        ("calculate", {"expression": "6*7"}, 200, "ok"),
        ("calculate", {"expression": ""}, 422, "error"),
        ("nope", {}, 404, "error"),
    ]
    for operation, body, code, status in cases:
        response = api.post(f"/v1/ops/{operation}", json=body,
                            headers={**headers, "X-Makma-Run-Id": "run-9"})
        assert response.status_code == code
        envelope = response.json()
        assert list(validator.iter_errors(envelope)) == []
        assert envelope["status"] == status and envelope["run_id"] == "run-9"
    raw = api.post("/v1/ops/calculate", content=b"not json",
                   headers={**headers, "Content-Type": "application/json"})
    assert raw.status_code == 422 and raw.json()["error"]["code"] == "INVALID_INPUT"


def test_workflow_api_inputs_trace_cancel_and_approval_token():
    api = client(approval_token="approve-me")
    body = {
        "name": "publish-flow",
        "input_schema": {"type": "object", "required": ["expr"],
                         "properties": {"expr": {"type": "string"}}},
        "inputs": {"expr": "2*21"},
        "correlation_id": "corr-api",
        "steps": [
            {"id": "calc", "tool_name": "calculator",
             "arguments": {"expression": "${inputs.expr}"}},
            {"id": "pub", "tool_name": "publish",
             "arguments": {"text": "${steps.calc.output}"}, "depends_on": ["calc"]},
        ],
    }
    assert api.post("/v1/workflows/run", json={**body, "inputs": {}}).status_code == 422
    paused = api.post("/v1/workflows/run", json=body).json()
    assert paused["status"] == "paused" and paused["pending_step"] == "pub"
    run_id = paused["run_id"]

    # Client "resume" cannot pass the gate; approval needs the separate credential.
    assert api.post(f"/v1/workflows/{run_id}/resume").json()["status"] == "paused"
    denied = api.post(f"/v1/workflows/{run_id}/approve",
                      headers={"X-Makma-Approval-Token": "wrong"})
    assert denied.status_code == 401
    done = api.post(f"/v1/workflows/{run_id}/approve",
                    headers={"X-Makma-Approval-Token": "approve-me"}).json()
    assert done["status"] == "succeeded"
    assert done["outputs"]["pub"] == "published:2*21 = 42"

    trace = api.get(f"/v1/workflows/{run_id}/trace").json()
    assert {event["correlation_id"] for event in trace} == {"corr-api"}
    assert api.get("/v1/workflows/missing/trace").status_code == 404
    assert api.post(f"/v1/workflows/{run_id}/cancel").status_code == 409

    second = api.post("/v1/workflows/run", json=body).json()
    cancelled = api.post(f"/v1/workflows/{second['run_id']}/cancel").json()
    assert cancelled["status"] == "cancelled"


def test_workflow_api_denies_specialists_unless_allowlisted_and_reports_unavailable():
    step = {"id": "r", "specialist": "agentic-rag-engine", "operation": "retrieve",
            "arguments": {"query": "q"}}
    denied = client().post("/v1/workflows/run", json={"name": "x", "steps": [step]})
    assert denied.status_code == 422 and "not permitted" in denied.json()["detail"]

    allowed = client(allowlist="agentic-rag-engine.retrieve")
    failed = allowed.post("/v1/workflows/run", json={"name": "x", "steps": [step]}).json()
    assert failed["status"] == "failed" and failed["error_code"] == "SPECIALIST_UNAVAILABLE"
    status = {row["system"]: row["state"] for row in allowed.get("/v1/specialists").json()}
    assert set(status.values()) == {"unavailable"} and len(status) == 8


def test_client_cannot_widen_workflow_permissions():
    response = client().post("/v1/workflows/run", json={
        "name": "x", "permissions": ["calculator", "agentic-rag-engine.ingest"],
        "steps": [{"id": "i", "specialist": "agentic-rag-engine", "operation": "ingest",
                   "arguments": {}}],
    })
    assert response.status_code == 422
