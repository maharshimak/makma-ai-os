"""MAK'MA shared execution contract ``makma.v1`` (orchestrator side).

Two responsibilities live here:

* the Pydantic envelope used by MAK'MA AI OS for its *own* operations
  (``system == "makma-ai-os"``), plus ``capabilities()`` / ``run_operation()``;
* :func:`validate_envelope`, which checks an envelope produced by *any* specialist
  system against the vendored JSON Schema ``contracts/makma.v1.schema.json``
  (a byte-identical copy ships inside the package as ``makma/schemas``).

Every operation implemented here is deterministic, offline code; none of them call
a model, so ``execution_mode`` is always ``deterministic_offline``.
"""

from __future__ import annotations

import ast
import hashlib
import json
import math
import re
import secrets
import time
from collections.abc import Callable
from datetime import UTC, datetime
from functools import cache
from importlib import metadata, resources
from typing import Any, Literal
from uuid import uuid4

from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTRACT_VERSION = "makma.v1"
SYSTEM = "makma-ai-os"
KNOWN_SYSTEMS: tuple[str, ...] = (
    "makma-ai-os",
    "agentic-rag-engine",
    "multimodal-ai-studio",
    "knowledge-twin",
    "secure-data-copilot",
    "clinical-document-intelligence",
    "llm-eval-observability",
    "mlops-control-plane",
    "mlops-production-pipeline",
)
SPECIALIST_SYSTEMS: tuple[str, ...] = tuple(name for name in KNOWN_SYSTEMS if name != SYSTEM)

Status = Literal["ok", "error", "blocked", "pending_approval"]
ExecutionMode = Literal["deterministic_offline", "local_model", "remote_model"]
ProvenanceKind = Literal["document", "chunk", "artifact", "dataset", "model", "query", "record"]
SystemName = Literal[
    "makma-ai-os",
    "agentic-rag-engine",
    "multimodal-ai-studio",
    "knowledge-twin",
    "secure-data-copilot",
    "clinical-document-intelligence",
    "llm-eval-observability",
    "mlops-control-plane",
    "mlops-production-pipeline",
]

OPERATION_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_MAX_VIOLATIONS = 20


# --------------------------------------------------------------------------- helpers


def canonical_json(value: Any) -> str:
    """Canonical JSON used for provenance hashes (sorted keys, compact, UTF-8)."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def new_trace_id() -> str:
    while True:
        value = secrets.token_hex(16)
        if value != "0" * 32:  # all-zero ids are invalid in W3C trace-context
            return value


def new_span_id() -> str:
    while True:
        value = secrets.token_hex(8)
        if value != "0" * 16:
            return value


def utc_now_rfc3339() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# --------------------------------------------------------------------------- envelope model


class ContractError(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{0,63}$")
    message: str = Field(max_length=2000)
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class ProvenanceRef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    kind: ProvenanceKind
    id: str = Field(min_length=1)
    sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    span: tuple[int, int] | None = None
    uri: str | None = None

    @model_validator(mode="after")
    def _non_negative_span(self) -> ProvenanceRef:
        if self.span is not None and (self.span[0] < 0 or self.span[1] < 0):
            raise ValueError("provenance span offsets must be non-negative")
        return self


class PolicyDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    decision: Literal["allow", "deny", "requires_approval"]
    reasons: list[str] = Field(default_factory=list)


class Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    contract_version: Literal["makma.v1"] = CONTRACT_VERSION
    system: SystemName = SYSTEM
    operation: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    run_id: str = Field(min_length=1, max_length=128)
    correlation_id: str = Field(min_length=1, max_length=128)
    trace_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    span_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    status: Status
    execution_mode: ExecutionMode
    data: Any = None
    error: ContractError | None = None
    provenance: list[ProvenanceRef] = Field(default_factory=list)
    policy: PolicyDecision | None = None
    started_at: str
    duration_ms: float = Field(ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def _status_rules(self) -> Envelope:
        if self.status == "ok" and self.error is not None:
            raise ValueError("status 'ok' requires error == null")
        if self.status != "ok" and self.status != "pending_approval" and self.error is None:
            raise ValueError(f"status '{self.status}' requires an error object")
        if self.status in {"error", "blocked"} and self.data is not None:
            raise ValueError(f"status '{self.status}' requires data == null")
        if self.status == "pending_approval" and (
            self.policy is None or self.policy.decision != "requires_approval"
        ):
            raise ValueError(
                "status 'pending_approval' requires policy.decision 'requires_approval'"
            )
        _check_rfc3339_utc(self.started_at)
        return self

    def to_dict(self) -> dict[str, Any]:
        payload = self.model_dump(mode="json")
        # tuples dump as lists already; keep the exact key set required by the schema.
        return payload


def _check_rfc3339_utc(value: str) -> None:
    if not isinstance(value, str) or "T" not in value:
        raise ValueError("started_at must be an RFC3339 timestamp")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError("started_at must be an RFC3339 timestamp") from error
    offset = parsed.utcoffset()
    if offset is None or offset.total_seconds() != 0:
        raise ValueError("started_at must be in UTC")


# --------------------------------------------------------------------------- schema validation


@cache
def contract_schema() -> dict[str, Any]:
    """The vendored makma.v1 JSON Schema (packaged byte-identical copy)."""
    text = resources.files("makma").joinpath("schemas/makma.v1.schema.json").read_text("utf-8")
    return json.loads(text)


@cache
def _schema_validator() -> Draft202012Validator:
    schema = contract_schema()
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _describe(error: Any) -> str:
    # Location + violated keyword only. Never echo the offending value: a malformed
    # specialist envelope may carry data that must not be passed through.
    location = "/".join(str(part) for part in error.absolute_path) or "<root>"
    return f"{location}: violates '{error.validator}'"


class EnvelopeValidationError(ValueError):
    def __init__(self, violations: list[str]) -> None:
        super().__init__("makma.v1 envelope failed validation: " + "; ".join(violations[:5]))
        self.violations = violations


def validate_envelope(
    payload: object,
    *,
    expected_system: str | None = None,
    expected_operation: str | None = None,
    expected_run_id: str | None = None,
    expected_correlation_id: str | None = None,
) -> list[str]:
    """Return makma.v1 violations for ``payload`` (an empty list means valid).

    Checks the JSON Schema plus rules the schema cannot express: RFC3339 UTC
    ``started_at``, finite ``duration_ms`` and the optional caller expectations
    (the envelope must come from the system/operation/run that was called).
    """
    if not isinstance(payload, dict):
        return ["<root>: envelope must be a JSON object"]
    violations = sorted(
        {_describe(error) for error in _schema_validator().iter_errors(payload)}
    )
    started_at = payload.get("started_at")
    if isinstance(started_at, str):
        try:
            _check_rfc3339_utc(started_at)
        except ValueError as error:
            violations.append(f"started_at: {error}")
    duration = payload.get("duration_ms")
    if isinstance(duration, float) and not math.isfinite(duration):
        violations.append("duration_ms: must be finite")
    expectations = {
        "system": expected_system,
        "operation": expected_operation,
        "run_id": expected_run_id,
        "correlation_id": expected_correlation_id,
    }
    for key, expected in expectations.items():
        if expected is not None and payload.get(key) != expected:
            violations.append(f"{key}: does not match the request")
    return violations[:_MAX_VIOLATIONS]


def ensure_valid_envelope(payload: object, **expectations: str | None) -> dict[str, Any]:
    violations = validate_envelope(payload, **expectations)
    if violations:
        raise EnvelopeValidationError(violations)
    assert isinstance(payload, dict)
    return payload


# --------------------------------------------------------------------------- own operations


def _package_version() -> str:
    try:
        return metadata.version("makma-ai-os")
    except metadata.PackageNotFoundError:
        return "0.0.0+unknown"


_WORKFLOW_STEP_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id"],
    "properties": {
        "id": {"type": "string", "minLength": 1, "maxLength": 100},
        "tool_name": {"type": "string", "maxLength": 200},
        "specialist": {"type": "string", "maxLength": 64},
        "operation": {"type": "string", "maxLength": 64},
        "arguments": {"type": "object"},
        "depends_on": {"type": "array", "items": {"type": "string"}, "maxItems": 100},
        "retryable": {"type": "boolean"},
        "max_attempts": {"type": "integer", "minimum": 1, "maximum": 10},
        "timeout_s": {"type": ["number", "null"], "exclusiveMinimum": 0, "maximum": 3600},
        "requires_approval": {"type": "boolean"},
        "approval_argument": {"type": ["string", "null"], "maxLength": 64},
        "accept_pending_approval": {"type": "boolean"},
    },
}

OPERATIONS: dict[str, dict[str, Any]] = {
    "calculate": {
        "description": "Evaluate an arithmetic expression with the AST-restricted calculator.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["expression"],
            "properties": {"expression": {"type": "string", "minLength": 1, "maxLength": 200}},
        },
    },
    "plan_message": {
        "description": "Turn a message into auditable tool steps with the rule-based planner.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["message"],
            "properties": {"message": {"type": "string", "minLength": 1, "maxLength": 20000}},
        },
    },
    "validate_workflow": {
        "description": "Statically validate a workflow DAG and return its execution order.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["name", "steps"],
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 200},
                "steps": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 100,
                    "items": _WORKFLOW_STEP_SCHEMA,
                },
                "input_schema": {"type": "object"},
            },
        },
    },
    "validate_envelope": {
        "description": "Check any system's envelope against the makma.v1 JSON Schema.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["envelope"],
            "properties": {
                "envelope": {},
                "expected_system": {"type": "string", "enum": list(KNOWN_SYSTEMS)},
            },
        },
    },
}


def capabilities() -> dict[str, Any]:
    return {
        "contract_version": CONTRACT_VERSION,
        "system": SYSTEM,
        "version": _package_version(),
        "operations": [
            {
                "name": name,
                "side_effects": False,
                "requires_approval": False,
                "input_schema": spec["input_schema"],
                "timeout_s": 30,
            }
            for name, spec in OPERATIONS.items()
        ],
    }


class _OperationInputError(ValueError):
    def __init__(self, violations: list[str]) -> None:
        super().__init__("; ".join(violations))
        self.violations = violations


def _op_calculate(payload: dict[str, Any]) -> tuple[dict[str, Any], list[ProvenanceRef]]:
    from makma.tools import _evaluate_math

    expression = payload["expression"].strip()
    try:
        value = _evaluate_math(ast.parse(expression, mode="eval"))
    except (SyntaxError, ArithmeticError, RecursionError, ValueError) as error:
        raise _OperationInputError(["expression: not a supported arithmetic expression"]) from error
    if not math.isfinite(value):
        raise _OperationInputError(["expression: result is not finite"])
    result: int | float = int(value) if value.is_integer() else round(value, 10)
    data = {"expression": expression, "result": result}
    return data, [ProvenanceRef(kind="query", id="expression", sha256=sha256_json(expression))]


def _op_plan_message(payload: dict[str, Any]) -> tuple[dict[str, Any], list[ProvenanceRef]]:
    from makma.planner import Planner

    message = payload["message"]
    steps = [
        {
            "kind": step.kind,
            "description": step.description,
            "tool_name": step.tool_name,
            "arguments": step.arguments,
        }
        for step in Planner().plan(message)
    ]
    data = {"planner": "rule_based", "steps": steps}
    return data, [ProvenanceRef(kind="query", id="message", sha256=sha256_json(message))]


def _op_validate_workflow(payload: dict[str, Any]) -> tuple[dict[str, Any], list[ProvenanceRef]]:
    from makma.workflows import WorkflowSpec, WorkflowStep

    errors: list[str] = []
    order: list[str] = []
    try:
        spec = WorkflowSpec(
            name=payload["name"],
            steps=tuple(
                WorkflowStep(
                    id=item["id"],
                    tool_name=item.get("tool_name", ""),
                    arguments=item.get("arguments", {}),
                    depends_on=tuple(item.get("depends_on", ())),
                    specialist=item.get("specialist"),
                    operation=item.get("operation"),
                    retryable=item.get("retryable", False),
                    max_attempts=item.get("max_attempts", 1),
                    timeout_s=item.get("timeout_s"),
                    requires_approval=item.get("requires_approval", False),
                    approval_argument=item.get("approval_argument"),
                    accept_pending_approval=item.get("accept_pending_approval", False),
                )
                for item in payload["steps"]
            ),
            input_schema=payload.get("input_schema"),
        )
        spec.validate()
        order = [step.id for step in spec.topological_order()]
    except ValueError as error:
        errors.append(str(error)[:500])
    data = {"valid": not errors, "order": order, "errors": errors}
    return data, [ProvenanceRef(kind="record", id="workflow", sha256=sha256_json(payload))]


def _op_validate_envelope(payload: dict[str, Any]) -> tuple[dict[str, Any], list[ProvenanceRef]]:
    violations = validate_envelope(
        payload["envelope"], expected_system=payload.get("expected_system")
    )
    data = {"valid": not violations, "violations": violations}
    digest = sha256_json(payload["envelope"])
    return data, [ProvenanceRef(kind="record", id="envelope", sha256=digest)]


_HANDLERS: dict[str, Callable[[dict[str, Any]], tuple[dict[str, Any], list[ProvenanceRef]]]] = {
    "calculate": _op_calculate,
    "plan_message": _op_plan_message,
    "validate_workflow": _op_validate_workflow,
    "validate_envelope": _op_validate_envelope,
}


@cache
def _input_validator(operation: str) -> Draft202012Validator:
    return Draft202012Validator(OPERATIONS[operation]["input_schema"])


def _valid_id(value: object) -> bool:
    return isinstance(value, str) and 1 <= len(value) <= 128


def run_operation(
    operation: str,
    payload: dict[str, Any],
    *,
    run_id: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Execute one of MAK'MA AI OS's own makma.v1 operations and return the envelope."""
    started_at = utc_now_rfc3339()
    started = time.perf_counter()
    id_problem: str | None = None
    if run_id is not None and not _valid_id(run_id):
        id_problem = "run_id must be a 1-128 character string"
        run_id = None
    if correlation_id is not None and not _valid_id(correlation_id):
        id_problem = "correlation_id must be a 1-128 character string"
        correlation_id = None
    resolved_run_id = run_id or uuid4().hex
    safe_operation = operation if isinstance(operation, str) and OPERATION_RE.fullmatch(
        operation
    ) else "unknown"

    def envelope(
        status: Status,
        *,
        data: Any = None,
        error: ContractError | None = None,
        provenance: list[ProvenanceRef] | None = None,
    ) -> dict[str, Any]:
        return Envelope(
            operation=safe_operation,
            run_id=resolved_run_id,
            correlation_id=correlation_id or resolved_run_id,
            trace_id=new_trace_id(),
            span_id=new_span_id(),
            status=status,
            execution_mode="deterministic_offline",
            data=data,
            error=error,
            provenance=provenance or [],
            started_at=started_at,
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
        ).to_dict()

    if id_problem is not None:
        return envelope(
            "error",
            error=ContractError(code="INVALID_INPUT", message=id_problem, details={}),
        )
    if operation not in _HANDLERS:
        return envelope(
            "error",
            error=ContractError(
                code="UNKNOWN_OPERATION",
                message="Unknown operation for makma-ai-os.",
                details={"known_operations": sorted(_HANDLERS)},
            ),
        )
    violations = (
        sorted({_describe(error) for error in _input_validator(operation).iter_errors(payload)})
        if isinstance(payload, dict)
        else ["<root>: payload must be a JSON object"]
    )
    if violations:
        return envelope(
            "error",
            error=ContractError(
                code="INVALID_INPUT",
                message="Payload does not match the operation input schema.",
                details={"violations": violations[:_MAX_VIOLATIONS]},
            ),
        )
    try:
        data, provenance = _HANDLERS[operation](payload)
    except _OperationInputError as error:
        return envelope(
            "error",
            error=ContractError(
                code="INVALID_INPUT",
                message="Payload is well-formed but cannot be processed.",
                details={"violations": error.violations},
            ),
        )
    except Exception as error:  # pragma: no cover - defensive boundary
        return envelope(
            "error",
            error=ContractError(
                code="INTERNAL_ERROR",
                message=f"Operation failed: {type(error).__name__}",
                retryable=False,
            ),
        )
    return envelope("ok", data=data, provenance=provenance)
