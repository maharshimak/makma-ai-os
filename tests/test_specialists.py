"""SpecialistAdapter tests with fake in-process specialists and a mocked HTTP transport.

No other MAK'MA repository is imported; the fakes below implement makma.v1 directly.
"""

from __future__ import annotations

import json
import time

import httpx
import pytest

from makma.contracts import Envelope, new_span_id, new_trace_id, utc_now_rfc3339
from makma.resilience import RetryPolicy
from makma.specialists import (
    HttpSpecialistAdapter,
    InProcessSpecialistAdapter,
    SpecialistRegistry,
    TraceContext,
    UnavailableSpecialist,
)
from makma.tools import PermissionPolicy, ToolRegistry
from makma.workflows import SQLiteWorkflowStore, WorkflowEngine, WorkflowSpec, WorkflowStep

FAST = RetryPolicy(max_attempts=3, base_delay_seconds=0.0, max_delay_seconds=0.0)


class FakeRag:
    """Synthetic retrieval specialist with one read-only and one side-effecting op."""

    system = "agentic-rag-engine"

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.corrupt = False
        self.raise_error = False

    def capabilities(self) -> dict:
        return {
            "contract_version": "makma.v1",
            "system": self.system,
            "version": "0.0.0-test",
            "operations": [
                {"name": "retrieve", "side_effects": False, "requires_approval": False,
                 "timeout_s": 5,
                 "input_schema": {"type": "object", "additionalProperties": False,
                                  "required": ["query"],
                                  "properties": {"query": {"type": "string", "minLength": 1},
                                                 "top_k": {"type": "integer", "minimum": 1,
                                                           "maximum": 10}}}},
                {"name": "ingest", "side_effects": True, "requires_approval": True,
                 "timeout_s": 5,
                 "input_schema": {"type": "object", "required": ["doc"],
                                  "properties": {"doc": {"type": "string"}}}},
            ],
        }

    def run_operation(self, operation, payload, *, run_id=None, correlation_id=None):
        self.calls.append((operation, payload))
        if self.raise_error:
            raise RuntimeError("internal secret detail")
        run_id = run_id or "generated"
        if self.corrupt:
            return {"contract_version": "makma.v1", "system": self.system, "status": "ok",
                    "data": {"leak": "should never pass through"}}
        common = dict(system=self.system, operation=operation, run_id=run_id,
                      correlation_id=correlation_id or run_id, trace_id=new_trace_id(),
                      span_id=new_span_id(), execution_mode="deterministic_offline",
                      started_at=utc_now_rfc3339(), duration_ms=0.1)
        if operation == "retrieve":
            hits = [{"id": f"doc-{i}", "score": 1.0 / (i + 1)}
                    for i in range(payload.get("top_k", 2))]
            return Envelope(status="ok", data={"query": payload["query"], "hits": hits},
                            **common).to_dict()
        if operation == "ingest":
            return Envelope(status="ok", data={"stored": payload["doc"]}, **common).to_dict()
        return Envelope(status="error", error={"code": "UNKNOWN_OPERATION", "message": "no",
                                               "retryable": False, "details": {}},
                        **common).to_dict()


# --------------------------------------------------------------------------- in-process


@pytest.mark.asyncio
async def test_in_process_adapter_returns_validated_envelope():
    fake = FakeRag()
    adapter = InProcessSpecialistAdapter(fake.system, fake.run_operation, fake.capabilities)
    caps = await adapter.capabilities()
    assert caps.available and set(caps.operations) == {"retrieve", "ingest"}
    assert caps.operations["ingest"].approval_required
    outcome = await adapter.call("retrieve", {"query": "q", "top_k": 3}, run_id="r1",
                                 correlation_id="c1")
    assert outcome.ok and outcome.data["hits"][2]["id"] == "doc-2"
    assert outcome.envelope["run_id"] == "r1" and outcome.envelope["correlation_id"] == "c1"


@pytest.mark.asyncio
async def test_invalid_specialist_envelope_becomes_structured_error_never_passed_through():
    fake = FakeRag()
    fake.corrupt = True
    adapter = InProcessSpecialistAdapter(fake.system, fake.run_operation, fake.capabilities)
    outcome = await adapter.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.status == "error"
    assert outcome.envelope is None and outcome.data is None
    assert outcome.error["code"] == "CONTRACT_VIOLATION"
    assert "should never pass through" not in json.dumps(outcome.error)


@pytest.mark.asyncio
async def test_envelope_from_wrong_system_or_run_is_rejected():
    fake = FakeRag()
    adapter = InProcessSpecialistAdapter("knowledge-twin", fake.run_operation)
    outcome = await adapter.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.error["code"] == "CONTRACT_VIOLATION"
    assert "system: does not match the request" in outcome.error["details"]["violations"]

    def wrong_run(operation, payload, *, run_id=None, correlation_id=None):
        return fake.run_operation(operation, payload, run_id="other", correlation_id="c")

    adapter = InProcessSpecialistAdapter(fake.system, wrong_run)
    outcome = await adapter.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.error["code"] == "CONTRACT_VIOLATION"


@pytest.mark.asyncio
async def test_specialist_exception_and_unavailable_module_are_honest():
    fake = FakeRag()
    fake.raise_error = True
    adapter = InProcessSpecialistAdapter(fake.system, fake.run_operation)
    outcome = await adapter.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.status == "error" and outcome.error["code"] == "SPECIALIST_EXCEPTION"
    assert "secret" not in outcome.error["message"]

    missing = InProcessSpecialistAdapter.from_module("knowledge-twin", "no_such_module_xyz")
    assert isinstance(missing, UnavailableSpecialist)
    outcome = await missing.call("anything", {}, run_id="r", correlation_id="c")
    assert outcome.status == "unavailable"
    assert (await missing.capabilities()).available is False

    unconfigured = SpecialistRegistry().get("secure-data-copilot")
    outcome = await unconfigured.call("ask", {}, run_id="r", correlation_id="c")
    assert outcome.status == "unavailable" and outcome.error["code"] == "SPECIALIST_UNAVAILABLE"
    with pytest.raises(ValueError):
        SpecialistRegistry().get("not-a-system")


@pytest.mark.asyncio
async def test_malformed_calls_are_rejected_before_transport():
    fake = FakeRag()
    adapter = InProcessSpecialistAdapter(fake.system, fake.run_operation)
    for operation, payload in [("../admin", {}), ("Retrieve", {}), ("retrieve", ["x"]),
                               ("retrieve", {"x": float("nan")})]:
        outcome = await adapter.call(operation, payload, run_id="r", correlation_id="c")
        assert outcome.status == "error"
    assert fake.calls == []


@pytest.mark.asyncio
async def test_invalid_capabilities_mark_specialist_unavailable():
    def bad_caps():
        return {"contract_version": "makma.v1", "system": "agentic-rag-engine",
                "operations": [{"name": "retrieve", "side_effects": "no",
                                "requires_approval": False, "input_schema": {}}]}

    adapter = InProcessSpecialistAdapter("agentic-rag-engine", FakeRag().run_operation, bad_caps)
    caps = await adapter.capabilities()
    assert caps.available is False and caps.error["code"] == "CONTRACT_VIOLATION"


# --------------------------------------------------------------------------- HTTP


def http_adapter(handler, **kwargs) -> HttpSpecialistAdapter:
    kwargs.setdefault("retry", FAST)
    kwargs.setdefault("environ", {"RAG_TOKEN": "test-token"})
    kwargs.setdefault("token_env", "RAG_TOKEN")
    return HttpSpecialistAdapter("agentic-rag-engine", "https://rag.test",
                                 transport=httpx.MockTransport(handler), **kwargs)


@pytest.mark.asyncio
async def test_http_adapter_sends_bearer_ids_and_traceparent():
    fake = FakeRag()
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = json.loads(request.content)
        envelope = fake.run_operation("retrieve", body, run_id=request.headers["x-makma-run-id"],
                                      correlation_id=request.headers["x-makma-correlation-id"])
        return httpx.Response(200, json=envelope)

    adapter = http_adapter(handler)
    trace = TraceContext("a" * 32, "b" * 16)
    outcome = await adapter.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c",
                                 idempotency_key="idem-1", trace=trace)
    assert outcome.ok
    request = seen[0]
    assert request.url == "https://rag.test/v1/ops/retrieve"
    assert request.headers["authorization"] == "Bearer test-token"
    assert request.headers["traceparent"] == f"00-{'a' * 32}-{'b' * 16}-01"
    assert request.headers["idempotency-key"] == "idem-1"


@pytest.mark.asyncio
async def test_http_redirect_is_refused_and_not_followed():
    hits: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hits.append(str(request.url))
        return httpx.Response(307, headers={"location": "https://evil.test/steal"})

    outcome = await http_adapter(handler).call("retrieve", {"query": "q"}, run_id="r",
                                               correlation_id="c", retry_safe=True)
    assert outcome.error["code"] == "REDIRECT_REFUSED"
    assert hits == ["https://rag.test/v1/ops/retrieve"]


@pytest.mark.asyncio
async def test_http_retries_only_retryable_failures_of_retry_safe_calls():
    attempts = {"n": 0}

    def flaky(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        return httpx.Response(503)

    outcome = await http_adapter(flaky).call("retrieve", {"query": "q"}, run_id="r",
                                             correlation_id="c", retry_safe=True)
    assert outcome.status == "unavailable" and outcome.attempts == 3 and attempts["n"] == 3

    attempts["n"] = 0
    outcome = await http_adapter(flaky).call("retrieve", {"query": "q"}, run_id="r",
                                             correlation_id="c", retry_safe=False)
    assert attempts["n"] == 1 and outcome.attempts == 1

    attempts["n"] = 0

    def unauthorized(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        return httpx.Response(401)

    outcome = await http_adapter(unauthorized).call("retrieve", {"query": "q"}, run_id="r",
                                                    correlation_id="c", retry_safe=True)
    assert outcome.error["code"] == "SPECIALIST_UNAUTHORIZED" and attempts["n"] == 1

    attempts["n"] = 0

    def refused(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        raise httpx.ConnectError("refused", request=request)

    outcome = await http_adapter(refused).call("retrieve", {"query": "q"}, run_id="r",
                                               correlation_id="c", retry_safe=True)
    assert outcome.status == "unavailable" and attempts["n"] == 3


@pytest.mark.asyncio
async def test_http_invalid_body_is_contract_violation():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"contract_version": "makma.v1", "data": "raw"})

    outcome = await http_adapter(handler).call("retrieve", {"query": "q"}, run_id="r",
                                               correlation_id="c")
    assert outcome.error["code"] == "CONTRACT_VIOLATION" and outcome.envelope is None

    def html(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>hi</html>")

    outcome = await http_adapter(html).call("retrieve", {"query": "q"}, run_id="r",
                                            correlation_id="c")
    assert outcome.error["code"] == "CONTRACT_VIOLATION"


@pytest.mark.asyncio
async def test_http_credentials_missing_or_insecure_is_unavailable_without_request():
    hits: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hits.append(request)
        return httpx.Response(500)

    missing = http_adapter(handler, environ={})
    outcome = await missing.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.status == "unavailable"
    assert outcome.error["code"] == "SPECIALIST_CREDENTIALS_MISSING"

    insecure = HttpSpecialistAdapter("agentic-rag-engine", "http://rag.example.com",
                                     token_env="T", environ={"T": "x"},
                                     transport=httpx.MockTransport(handler))
    outcome = await insecure.call("retrieve", {"query": "q"}, run_id="r", correlation_id="c")
    assert outcome.error["code"] == "INSECURE_TRANSPORT"
    assert hits == []
    with pytest.raises(ValueError):
        HttpSpecialistAdapter("agentic-rag-engine", "https://user:pw@rag.test")


@pytest.mark.asyncio
async def test_registry_from_env_and_status():
    fake = FakeRag()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/capabilities":
            return httpx.Response(200, json=fake.capabilities())
        return httpx.Response(404)

    env = {"MAKMA_SPECIALIST_AGENTIC_RAG_ENGINE_URL": "https://rag.test",
           "MAKMA_SPECIALIST_AGENTIC_RAG_ENGINE_TOKEN": "t"}
    registry = SpecialistRegistry.from_env(env, transport=httpx.MockTransport(handler))
    assert registry.configured == ["agentic-rag-engine"]
    rows = {row["system"]: row for row in await registry.status()}
    assert rows["agentic-rag-engine"]["state"] == "available"
    assert rows["knowledge-twin"]["state"] == "unavailable"
    assert len(rows) == 8


# --------------------------------------------------------------------------- workflow steps


def specialist_engine(tmp_path, fake: FakeRag, allowed: set[str]) -> WorkflowEngine:
    specialists = SpecialistRegistry(
        [InProcessSpecialistAdapter(fake.system, fake.run_operation, fake.capabilities,
                                    retry=FAST)]
    )
    return WorkflowEngine(ToolRegistry(), policy=PermissionPolicy(allowed_tools=frozenset(allowed)),
                          store=SQLiteWorkflowStore(str(tmp_path / "s.sqlite")),
                          specialists=specialists, retry_delay=lambda attempt: 0.0)


@pytest.mark.asyncio
async def test_workflow_specialist_steps_dataflow_approval_and_exact_envelopes(tmp_path):
    fake = FakeRag()
    engine = specialist_engine(tmp_path, fake, {"agentic-rag-engine.retrieve",
                                                "agentic-rag-engine.ingest"})
    spec = WorkflowSpec(
        "rag",
        input_schema={"type": "object", "required": ["q"],
                      "properties": {"q": {"type": "string"}}},
        steps=(
            WorkflowStep("r", specialist="agentic-rag-engine", operation="retrieve",
                         arguments={"query": "${inputs.q}", "top_k": 2}),
            WorkflowStep("i", specialist="agentic-rag-engine", operation="ingest",
                         arguments={"doc": "${steps.r.data.hits.1.id}"}, depends_on=("r",)),
        ),
    )
    paused = await engine.start(spec, session_id="s", inputs={"q": "hello"}, correlation_id="cx")
    assert paused.status == "paused" and paused.pending_step == "i"
    done = await engine.resume(paused.run_id, approved_steps={"i"})
    assert done.status == "succeeded"
    assert fake.calls == [("retrieve", {"query": "hello", "top_k": 2}),
                          ("ingest", {"doc": "doc-1"})]
    envelope = done.results["i"]["envelope"]
    assert envelope["data"] == {"stored": "doc-1"}
    assert envelope["run_id"] == done.run_id and envelope["correlation_id"] == "cx"
    assert json.loads(done.outputs["i"]) == envelope
    linked = [e for e in engine.trace(done.run_id) if e["event"] == "step_succeeded"]
    assert all(len(e["detail"]["specialist_trace_id"]) == 32 for e in linked)


@pytest.mark.asyncio
async def test_workflow_specialist_input_schema_and_unavailable_states(tmp_path):
    fake = FakeRag()
    engine = specialist_engine(tmp_path, fake, {"agentic-rag-engine.retrieve",
                                                "knowledge-twin.query"})
    bad = WorkflowSpec("bad", (WorkflowStep("r", specialist="agentic-rag-engine",
                                            operation="retrieve",
                                            arguments={"query": "", "top_k": 99}),))
    failed = await engine.start(bad, session_id="s")
    assert failed.status == "failed" and failed.error_code == "INVALID_INPUT"
    assert fake.calls == []

    missing = WorkflowSpec("missing", (WorkflowStep("k", specialist="knowledge-twin",
                                                    operation="query", arguments={}),))
    failed = await engine.start(missing, session_id="s")
    assert failed.status == "failed" and failed.error_code == "SPECIALIST_UNAVAILABLE"
    step_failed = [e for e in engine.trace(failed.run_id) if e["event"] == "step_failed"][0]
    assert step_failed["detail"]["unavailable"] is True

    not_permitted = WorkflowSpec("np", (WorkflowStep("i", specialist="agentic-rag-engine",
                                                     operation="ingest",
                                                     arguments={"doc": "x"}),))
    with pytest.raises(ValueError, match="not permitted"):
        await engine.start(not_permitted, session_id="s")


@pytest.mark.asyncio
async def test_workflow_specialist_contract_violation_fails_step(tmp_path):
    fake = FakeRag()
    fake.corrupt = True
    engine = specialist_engine(tmp_path, fake, {"agentic-rag-engine.retrieve"})
    spec = WorkflowSpec("c", (WorkflowStep("r", specialist="agentic-rag-engine",
                                           operation="retrieve", arguments={"query": "q"}),))
    failed = await engine.start(spec, session_id="s")
    assert failed.status == "failed" and failed.error_code == "CONTRACT_VIOLATION"
    assert "r" not in failed.results and "r" not in failed.outputs


def test_step_declaration_validation():
    with pytest.raises(ValueError, match="not both"):
        WorkflowStep("x", "tool", specialist="agentic-rag-engine", operation="retrieve").validate()
    with pytest.raises(ValueError, match="unknown specialist"):
        WorkflowStep("x", specialist="makma-ai-os", operation="calculate").validate()
    with pytest.raises(ValueError, match="invalid operation"):
        WorkflowStep("x", specialist="agentic-rag-engine", operation="Bad Op").validate()
    started = time.perf_counter()
    WorkflowStep("x", specialist="agentic-rag-engine", operation="retrieve").validate()
    assert time.perf_counter() - started < 1
