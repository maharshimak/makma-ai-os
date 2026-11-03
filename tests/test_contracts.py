from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from makma.contracts import (
    Envelope,
    EnvelopeValidationError,
    capabilities,
    contract_schema,
    ensure_valid_envelope,
    run_operation,
    validate_envelope,
)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_SHA256 = "5914c9582ee2d7dfd56715827add8fc70fc9bd48b6cd3c514022245368c960d8"


def schema_validator() -> Draft202012Validator:
    schema = json.loads((ROOT / "contracts" / "makma.v1.schema.json").read_text("utf-8"))
    return Draft202012Validator(schema)


def test_vendored_schema_files_are_byte_identical_to_the_shared_contract():
    vendored = (ROOT / "contracts" / "makma.v1.schema.json").read_bytes()
    packaged = (ROOT / "src" / "makma" / "schemas" / "makma.v1.schema.json").read_bytes()
    assert hashlib.sha256(vendored).hexdigest() == SCHEMA_SHA256
    assert packaged == vendored
    assert contract_schema() == json.loads(vendored)


@pytest.mark.parametrize(
    ("operation", "payload", "status", "code"),
    [
        ("calculate", {"expression": "2 ** 10 - 24 / 4"}, "ok", None),
        ("plan_message", {"message": "calculate 6 * 7 and search my memory for atlas"}, "ok",
         None),
        ("validate_workflow", {"name": "w", "steps": [{"id": "a", "tool_name": "calculator"}]},
         "ok", None),
        ("validate_envelope", {"envelope": {"not": "an envelope"}}, "ok", None),
        ("calculate", {"expression": "__import__('os')"}, "error", "INVALID_INPUT"),
        ("calculate", {"expr": "1+1"}, "error", "INVALID_INPUT"),
        ("calculate", {"expression": 7}, "error", "INVALID_INPUT"),
        ("does_not_exist", {}, "error", "UNKNOWN_OPERATION"),
        ("Bad-Name!", {}, "error", "UNKNOWN_OPERATION"),
    ],
)
def test_real_run_operation_outputs_validate_against_json_schema(operation, payload, status, code):
    envelope = run_operation(operation, payload, run_id="run-1", correlation_id="corr-1")
    errors = sorted(schema_validator().iter_errors(envelope), key=str)
    assert errors == []
    assert validate_envelope(envelope, expected_system="makma-ai-os") == []
    assert envelope["status"] == status
    assert envelope["system"] == "makma-ai-os"
    assert envelope["execution_mode"] == "deterministic_offline"
    assert envelope["run_id"] == "run-1" and envelope["correlation_id"] == "corr-1"
    if code:
        assert envelope["error"]["code"] == code and envelope["data"] is None
    else:
        assert envelope["error"] is None


def test_operation_results_are_real():
    calc = run_operation("calculate", {"expression": "2 ** 10 - 24 / 4"})
    assert calc["data"] == {"expression": "2 ** 10 - 24 / 4", "result": 1018}
    expected = hashlib.sha256(json.dumps("2 ** 10 - 24 / 4").encode()).hexdigest()
    assert calc["provenance"][0]["sha256"] == expected
    assert calc["correlation_id"] == calc["run_id"]

    plan = run_operation("plan_message", {"message": "calculate 6 * 7"})
    assert plan["data"]["steps"][0]["tool_name"] == "calculator"

    cycle = run_operation("validate_workflow", {"name": "c", "steps": [
        {"id": "a", "tool_name": "t", "depends_on": ["b"]},
        {"id": "b", "tool_name": "t", "depends_on": ["a"]},
    ]})
    assert cycle["status"] == "ok" and cycle["data"]["valid"] is False
    assert "cycle" in cycle["data"]["errors"][0]
    ordered = run_operation("validate_workflow", {"name": "o", "steps": [
        {"id": "b", "tool_name": "t", "depends_on": ["a"]}, {"id": "a", "tool_name": "t"},
    ]})
    assert ordered["data"] == {"valid": True, "order": ["a", "b"], "errors": []}

    good = run_operation("calculate", {"expression": "1+1"})
    checked = run_operation("validate_envelope", {"envelope": good,
                                                  "expected_system": "makma-ai-os"})
    assert checked["data"] == {"valid": True, "violations": []}


def test_invalid_ids_are_rejected_not_echoed():
    envelope = run_operation("calculate", {"expression": "1"}, run_id="x" * 500)
    assert envelope["status"] == "error" and envelope["error"]["code"] == "INVALID_INPUT"
    assert validate_envelope(envelope) == []


def test_capabilities_shape():
    caps = capabilities()
    assert caps["contract_version"] == "makma.v1" and caps["system"] == "makma-ai-os"
    names = [op["name"] for op in caps["operations"]]
    assert names == ["calculate", "plan_message", "validate_workflow", "validate_envelope"]
    for op in caps["operations"]:
        Draft202012Validator.check_schema(op["input_schema"])
        assert op["side_effects"] is False and op["requires_approval"] is False


def _valid() -> dict:
    return run_operation("calculate", {"expression": "1+2"}, run_id="r", correlation_id="c")


@pytest.mark.parametrize(
    "mutate",
    [
        lambda e: e.update(status="ok", error={"code": "X", "message": "m", "retryable": False,
                                                "details": {}}),
        lambda e: e.update(status="error", error=None),
        lambda e: e.update(status="error", error={"code": "BAD", "message": "m",
                                                  "retryable": False, "details": {}}),
        lambda e: e.update(status="pending_approval", policy=None),
        lambda e: e.update(trace_id="ABC"),
        lambda e: e.update(span_id="0" * 15),
        lambda e: e.update(system="someone-else"),
        lambda e: e.update(contract_version="makma.v2"),
        lambda e: e.update(duration_ms=-1),
        lambda e: e.update(duration_ms=float("nan")),
        lambda e: e.update(started_at="2026-11-03T10:00:00+05:30"),
        lambda e: e.update(started_at="yesterday"),
        lambda e: e.update(extra_field=1),
        lambda e: e.pop("provenance"),
        lambda e: e.update(provenance=[{"kind": "document", "id": "d", "sha256": "abc",
                                        "span": None, "uri": None}]),
        lambda e: e.update(provenance=[{"kind": "document", "id": "d", "sha256": None,
                                        "span": [-1, 3], "uri": None}]),
        lambda e: e.update(error=None, status="blocked"),
    ],
)
def test_validator_rejects_contract_violations(mutate):
    envelope = _valid()
    mutate(envelope)
    assert validate_envelope(envelope) != []
    with pytest.raises(EnvelopeValidationError):
        ensure_valid_envelope(envelope)


def test_validator_checks_request_expectations_and_does_not_echo_values():
    envelope = _valid()
    assert validate_envelope(envelope, expected_operation="calculate", expected_run_id="r",
                             expected_correlation_id="c") == []
    assert validate_envelope(envelope, expected_system="agentic-rag-engine") == [
        "system: does not match the request"
    ]
    envelope["data"] = None
    envelope["status"] = "error"
    envelope["error"] = {"code": "lower", "message": "SECRET-VALUE-123", "retryable": False,
                         "details": {}}
    violations = validate_envelope(envelope)
    assert violations and not any("SECRET-VALUE-123" in item for item in violations)
    assert not any("lower" in item for item in violations)
    assert validate_envelope(["not", "a", "dict"]) == ["<root>: envelope must be a JSON object"]


def test_pydantic_envelope_enforces_status_rules():
    base = _valid()
    with pytest.raises(ValueError):
        Envelope(**{**base, "status": "error"})
    with pytest.raises(ValueError):
        Envelope(**{**base, "started_at": "2026-11-03T10:00:00"})
    Envelope(**base)
