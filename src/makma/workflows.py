"""Durable DAG workflow engine.

Guarantees (each covered by ``tests/test_workflow_engine.py``):

* inputs are validated against the workflow's JSON Schema before anything runs;
  the whole DAG (tools exist, actions permitted, references resolvable) is
  pre-flighted before the first step executes;
* run and step lifecycles are explicit state machines; illegal transitions raise
  :class:`IllegalTransition`;
* a step's ``running`` state (with its idempotency key) is committed *before* the
  step executes and its result is committed atomically with ``succeeded``, so a
  completed step is never executed again on resume or recovery;
* after a crash, :meth:`WorkflowEngine.recover` re-runs interrupted read-only or
  idempotent steps with the same idempotency key, and pauses interrupted
  non-idempotent side-effecting steps for a human decision instead of repeating them;
* approval is only accepted for the step that is currently ``awaiting_approval`` and
  is bound to a digest of that step's resolved arguments;
* per-step timeouts; bounded retries only for steps declared ``retryable``;
  cooperative and in-flight cancellation;
* an append-only trace with run_id / correlation_id / trace_id / span_id per event,
  written in the same SQLite transaction as the checkpoint.

Execution is sequential in deterministic topological order within one process.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import sqlite3
import threading
from collections import defaultdict
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from math import isfinite
from pathlib import Path
from typing import Any
from uuid import uuid4

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from makma.contracts import (
    OPERATION_RE,
    SPECIALIST_SYSTEMS,
    canonical_json,
    new_span_id,
    new_trace_id,
)
from makma.resilience import RetryPolicy
from makma.specialists import (
    CapabilitySnapshot,
    OperationSpec,
    SpecialistOutcome,
    SpecialistRegistry,
    TraceContext,
)
from makma.tools import PermissionPolicy, ToolRegistry, idempotency_scope

_REF_RE = re.compile(
    r"^\$\{(?P<scope>steps|inputs)\.(?P<head>[A-Za-z0-9_-]+)(?P<path>(?:\.[A-Za-z0-9_-]+)*)\}$"
)
_MAX_ERROR_CHARS = 500
_MAX_WORKFLOW_STEPS = 512
_MAX_AUTOMATIC_REPLAYS = 1


# =========================================================================== errors


class WorkflowValidationError(ValueError):
    """The workflow definition, its inputs or its permissions are invalid."""


class IllegalTransition(RuntimeError):
    """A run or step was asked to move to a state its state machine forbids."""


class WorkflowBusy(RuntimeError):
    """Another coroutine in this process is already advancing the run."""


class ApprovalError(PermissionError):
    """An approval does not match the step that is awaiting approval."""


# =========================================================================== state machines


class RunState(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    BLOCKED = "blocked"  # a policy (e.g. a specialist's) refused the work
    CANCELLED = "cancelled"


class StepState(StrEnum):
    PENDING = "pending"
    AWAITING_APPROVAL = "awaiting_approval"
    RUNNING = "running"
    UNCERTAIN = "uncertain"  # interrupted mid-execution; outcome unknown
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


RUN_TRANSITIONS: dict[RunState, frozenset[RunState]] = {
    RunState.PENDING: frozenset({RunState.RUNNING, RunState.CANCELLED}),
    RunState.RUNNING: frozenset(
        {
            RunState.PAUSED,
            RunState.SUCCEEDED,
            RunState.FAILED,
            RunState.BLOCKED,
            RunState.CANCELLED,
        }
    ),
    RunState.PAUSED: frozenset({RunState.RUNNING, RunState.CANCELLED}),
    RunState.SUCCEEDED: frozenset(),
    RunState.FAILED: frozenset(),
    RunState.BLOCKED: frozenset(),
    RunState.CANCELLED: frozenset(),
}

STEP_TRANSITIONS: dict[StepState, frozenset[StepState]] = {
    StepState.PENDING: frozenset(
        {StepState.RUNNING, StepState.AWAITING_APPROVAL, StepState.FAILED, StepState.CANCELLED}
    ),
    StepState.AWAITING_APPROVAL: frozenset(
        {StepState.RUNNING, StepState.FAILED, StepState.CANCELLED}
    ),
    StepState.RUNNING: frozenset(
        {
            StepState.SUCCEEDED,
            StepState.FAILED,
            StepState.BLOCKED,
            StepState.PENDING,  # retry scheduled, or recovered read-only/idempotent step
            StepState.UNCERTAIN,
            StepState.CANCELLED,
        }
    ),
    StepState.UNCERTAIN: frozenset({StepState.AWAITING_APPROVAL, StepState.CANCELLED}),
    StepState.SUCCEEDED: frozenset(),
    StepState.FAILED: frozenset(),
    StepState.BLOCKED: frozenset(),
    StepState.CANCELLED: frozenset(),
}

TERMINAL_RUN_STATES = frozenset(
    {RunState.SUCCEEDED, RunState.FAILED, RunState.BLOCKED, RunState.CANCELLED}
)


def check_run_transition(current: str, new: str) -> None:
    if RunState(new) not in RUN_TRANSITIONS[RunState(current)]:
        raise IllegalTransition(f"Run cannot move from {current!r} to {new!r}.")


def check_step_transition(current: str, new: str) -> None:
    if StepState(new) not in STEP_TRANSITIONS[StepState(current)]:
        raise IllegalTransition(f"Step cannot move from {current!r} to {new!r}.")


# =========================================================================== definitions


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _iter_refs(value: object):
    if isinstance(value, str):
        match = _REF_RE.fullmatch(value)
        if match:
            yield match
        elif "${" in value:
            raise WorkflowValidationError(
                "References must be a whole string of the form ${steps.ID.output}, "
                "${steps.ID.data[.path]} or ${inputs.NAME[.path]}."
            )
    elif isinstance(value, list):
        for item in value:
            yield from _iter_refs(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _iter_refs(item)


@dataclass(frozen=True, slots=True)
class WorkflowStep:
    """One DAG node: either a registered tool or a specialist operation.

    Tool step:        ``WorkflowStep("a", "calculator", {...})``
    Specialist step:  ``WorkflowStep("r", specialist="agentic-rag-engine",
                      operation="retrieve", arguments={...})``

    ``requires_approval`` can only tighten the gate; tool/specialist metadata and
    the permission policy decide the minimum.

    Specialist approval translation (explicit, opt-in per step):

    * ``approval_argument``: name of the specialist's own approval flag (for example
      ``"approved"`` for multimodal-ai-studio ``execute``). The engine sets it to
      ``true`` only after *this engine* recorded an approval for the step; workflow
      arguments may never contain it, so it cannot be supplied by a client or model.
    * ``accept_pending_approval``: a specialist ``pending_approval`` envelope (a
      decision that still needs a human, e.g. mlops-control-plane
      ``evaluate_promotion``) completes the step with its data instead of failing it.
      The human decision must then be taken by an approval-gated downstream step.
    """

    id: str
    tool_name: str = ""
    arguments: dict[str, object] = field(default_factory=dict)
    depends_on: tuple[str, ...] = ()
    specialist: str | None = None
    operation: str | None = None
    retryable: bool = False
    max_attempts: int = 1
    timeout_s: float | None = None
    requires_approval: bool = False
    approval_argument: str | None = None
    accept_pending_approval: bool = False

    @property
    def kind(self) -> str:
        return "specialist" if self.specialist else "tool"

    @property
    def action(self) -> str:
        """Permission identifier: tool name, or ``"<system>.<operation>"``."""
        return f"{self.specialist}.{self.operation}" if self.specialist else self.tool_name

    def validate(self) -> None:
        if not isinstance(self.id, str) or not self.id.strip() or not re.fullmatch(
            r"[A-Za-z0-9_-]{1,100}", self.id
        ):
            raise WorkflowValidationError(
                "Workflow step IDs must be 1-100 characters of [A-Za-z0-9_-]."
            )
        if self.specialist is not None or self.operation is not None:
            if self.tool_name:
                raise WorkflowValidationError(
                    f"Step {self.id} must name either a tool or a specialist operation, not both."
                )
            if self.specialist not in SPECIALIST_SYSTEMS:
                raise WorkflowValidationError(f"Step {self.id}: unknown specialist system.")
            if not isinstance(self.operation, str) or not OPERATION_RE.fullmatch(self.operation):
                raise WorkflowValidationError(f"Step {self.id}: invalid operation name.")
        elif not isinstance(self.tool_name, str) or not self.tool_name.strip():
            raise WorkflowValidationError("Workflow tools must be non-empty.")
        if (self.approval_argument is not None or self.accept_pending_approval) and (
            self.kind != "specialist"
        ):
            raise WorkflowValidationError(
                f"Step {self.id}: approval translation applies to specialist steps only."
            )
        if self.approval_argument is not None:
            if not isinstance(self.approval_argument, str) or not re.fullmatch(
                r"[A-Za-z_][A-Za-z0-9_]{0,63}", self.approval_argument
            ):
                raise WorkflowValidationError(f"Step {self.id}: invalid approval_argument.")
            if isinstance(self.arguments, dict) and self.approval_argument in self.arguments:
                raise WorkflowValidationError(
                    f"Step {self.id}: {self.approval_argument!r} is set by the engine after "
                    "approval and must not appear in the workflow arguments."
                )
        if not isinstance(self.arguments, dict):
            raise WorkflowValidationError(f"Step {self.id}: arguments must be an object.")
        try:
            json.dumps(self.arguments, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise WorkflowValidationError(
                f"Step {self.id}: arguments must be strict JSON."
            ) from error
        if (
            isinstance(self.max_attempts, bool)
            or not isinstance(self.max_attempts, int)
            or not 1 <= self.max_attempts <= 10
        ):
            raise WorkflowValidationError(f"Step {self.id}: max_attempts must be 1-10.")
        if self.max_attempts > 1 and not self.retryable:
            raise WorkflowValidationError(
                f"Step {self.id}: max_attempts > 1 requires retryable=True."
            )
        if self.timeout_s is not None and (
            isinstance(self.timeout_s, bool)
            or not isinstance(self.timeout_s, (int, float))
            or not 0 < self.timeout_s <= 3600
        ):
            raise WorkflowValidationError(f"Step {self.id}: timeout_s must be in (0, 3600].")


@dataclass(frozen=True, slots=True)
class WorkflowSpec:
    name: str
    steps: tuple[WorkflowStep, ...]
    input_schema: dict[str, Any] | None = None
    # Least privilege: the actions this workflow may use. ``None`` means exactly the
    # actions its steps reference. Always intersected with the engine policy.
    permissions: frozenset[str] | None = None

    def validate(self) -> None:
        if not self.name.strip() or not self.steps:
            raise WorkflowValidationError("Workflow requires a name and at least one step.")
        if len(self.steps) > _MAX_WORKFLOW_STEPS:
            raise WorkflowValidationError(f"Workflow exceeds {_MAX_WORKFLOW_STEPS} steps.")
        ids = [step.id for step in self.steps]
        if len(ids) != len(set(ids)) or any(not str(step_id).strip() for step_id in ids):
            raise WorkflowValidationError("Workflow step IDs must be unique non-empty strings.")
        known = set(ids)
        for step in self.steps:
            step.validate()
            unknown = set(step.depends_on) - known
            if unknown:
                raise WorkflowValidationError(
                    f"Unknown dependencies for {step.id}: {sorted(unknown)}"
                )
            if step.id in step.depends_on:
                raise WorkflowValidationError("A workflow step cannot depend on itself.")
        if self.input_schema is not None:
            if not isinstance(self.input_schema, dict):
                raise WorkflowValidationError("input_schema must be a JSON Schema object.")
            try:
                Draft202012Validator.check_schema(self.input_schema)
            except SchemaError as error:
                raise WorkflowValidationError("input_schema is not a valid JSON Schema.") from error
        order = self.topological_order()
        ancestors: dict[str, set[str]] = {}
        for step in order:
            ancestors[step.id] = set()
            for dep in step.depends_on:
                ancestors[step.id] |= {dep, *ancestors[dep]}
        declared_inputs = (
            set(self.input_schema.get("properties", {}))
            if isinstance(self.input_schema, dict)
            else None
        )
        for step in self.steps:
            for match in _iter_refs(step.arguments):
                head = match.group("head")
                path = [part for part in match.group("path").split(".") if part]
                if match.group("scope") == "steps":
                    if head not in ancestors[step.id]:
                        raise WorkflowValidationError(
                            f"Step {step.id} references {head!r}, which is not one of its "
                            "(transitive) dependencies."
                        )
                    if not path or path[0] not in {"output", "data"} or (
                        path[0] == "output" and len(path) > 1
                    ):
                        raise WorkflowValidationError(
                            f"Step {step.id}: step references must use .output or .data[.path]."
                        )
                elif declared_inputs is None or head not in declared_inputs:
                    raise WorkflowValidationError(
                        f"Step {step.id} references undeclared input {head!r}."
                    )

    def topological_order(self) -> tuple[WorkflowStep, ...]:
        by_id = {step.id: step for step in self.steps}
        dependents: dict[str, list[str]] = defaultdict(list)
        outstanding: dict[str, int] = {}
        for step_id, step in by_id.items():
            dependencies = set(step.depends_on)
            outstanding[step_id] = len(dependencies)
            for dependency in dependencies:
                dependents[dependency].append(step_id)
        ready = [step_id for step_id, count in outstanding.items() if count == 0]
        ordered: list[WorkflowStep] = []
        while ready:
            next_wave = []
            for step_id in sorted(ready):
                ordered.append(by_id[step_id])
                for child in dependents.get(step_id, ()):
                    outstanding[child] -= 1
                    if outstanding[child] == 0:
                        next_wave.append(child)
            ready = next_wave
        if len(ordered) != len(by_id):
            raise WorkflowValidationError("Workflow dependency graph contains a cycle.")
        return tuple(ordered)

    def permitted_actions(self) -> frozenset[str]:
        if self.permissions is not None:
            return frozenset(self.permissions)
        return frozenset(step.action for step in self.steps)

    def to_json(self) -> str:
        payload = {
            "name": self.name,
            "steps": [asdict(step) for step in self.steps],
            "input_schema": self.input_schema,
            "permissions": sorted(self.permissions) if self.permissions is not None else None,
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    @classmethod
    def from_json(cls, text: str) -> WorkflowSpec:
        raw = json.loads(text)
        steps = []
        for item in raw["steps"]:
            item = dict(item)
            item["depends_on"] = tuple(item.get("depends_on", ()))
            item.setdefault("arguments", {})
            steps.append(WorkflowStep(**item))
        permissions = raw.get("permissions")
        return cls(
            name=raw["name"],
            steps=tuple(steps),
            input_schema=raw.get("input_schema"),
            permissions=frozenset(permissions) if permissions is not None else None,
        )


@dataclass(slots=True)
class WorkflowCheckpoint:
    run_id: str
    workflow_name: str
    session_id: str
    status: str = RunState.RUNNING.value
    completed_steps: list[str] = field(default_factory=list)
    outputs: dict[str, str] = field(default_factory=dict)
    pending_step: str | None = None
    error: str | None = None
    correlation_id: str = ""
    trace_id: str = ""
    root_span_id: str = ""
    inputs: dict[str, Any] = field(default_factory=dict)
    # step_id -> {"state", "attempts", "idempotency_key", "span_id", "approval_digest",
    #             "pending_reason", "error"}
    steps: dict[str, dict[str, Any]] = field(default_factory=dict)
    # step_id -> exact persisted result ({"kind": "tool", "output": ...} or
    #            {"kind": "specialist", "envelope": {...}})
    results: dict[str, dict[str, Any]] = field(default_factory=dict)
    pending_reason: str | None = None
    error_code: str | None = None


# =========================================================================== persistence


def _upgrade_legacy_checkpoint(spec: WorkflowSpec, checkpoint: WorkflowCheckpoint) -> None:
    """Derive per-step state for checkpoints written before step records existed."""
    checkpoint.correlation_id = checkpoint.correlation_id or checkpoint.run_id
    checkpoint.trace_id = checkpoint.trace_id or new_trace_id()
    checkpoint.root_span_id = checkpoint.root_span_id or new_span_id()
    for step in spec.steps:
        if step.id in checkpoint.completed_steps:
            state = StepState.SUCCEEDED
            checkpoint.results.setdefault(
                step.id, {"kind": "tool", "output": checkpoint.outputs.get(step.id, "")}
            )
        elif step.id == checkpoint.pending_step and checkpoint.status == RunState.PAUSED:
            state = StepState.AWAITING_APPROVAL
        elif step.id == checkpoint.pending_step and checkpoint.status == RunState.FAILED:
            state = StepState.FAILED
        else:
            state = StepState.PENDING
        checkpoint.steps[step.id] = {
            "state": state.value,
            "attempts": 1 if state in {StepState.SUCCEEDED, StepState.FAILED} else 0,
            "idempotency_key": None,
            "span_id": None,
            "approval_digest": None,
            "approved": False,
            "pending_reason": "approval_required" if state == StepState.AWAITING_APPROVAL
            else None,
            "error": None,
        }


class SQLiteWorkflowStore:
    """Durable workflow checkpoints and trace, for resume, inspection and crash recovery."""

    def __init__(self, path: str) -> None:
        self.path = path
        if path != ":memory:":
            Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)
        # The API creates the store on one thread and may serve requests on another
        # (e.g. TestClient, threaded servers); a lock serialises access instead.
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._guard = threading.Lock()
        with self._connection:
            self._connection.execute("PRAGMA foreign_keys = ON")
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS workflow_runs (
                    run_id TEXT PRIMARY KEY,
                    spec_json TEXT NOT NULL,
                    checkpoint_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            columns = {
                row[1] for row in self._connection.execute("PRAGMA table_info(workflow_runs)")
            }
            if "cancel_requested" not in columns:
                self._connection.execute(
                    "ALTER TABLE workflow_runs ADD COLUMN cancel_requested INTEGER NOT NULL "
                    "DEFAULT 0"
                )
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS workflow_trace (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    correlation_id TEXT NOT NULL,
                    trace_id TEXT NOT NULL,
                    span_id TEXT NOT NULL,
                    parent_span_id TEXT,
                    step_id TEXT,
                    event TEXT NOT NULL,
                    attempt INTEGER,
                    detail_json TEXT NOT NULL,
                    at TEXT NOT NULL
                )
                """
            )
            self._connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_workflow_trace_run ON workflow_trace(run_id, seq)"
            )

    def save(
        self,
        spec: WorkflowSpec,
        checkpoint: WorkflowCheckpoint,
        events: list[dict[str, Any]] | None = None,
    ) -> None:
        """Persist the checkpoint and its trace events in one transaction."""
        with self._guard, self._connection:
            self._connection.execute(
                """
                INSERT INTO workflow_runs(run_id, spec_json, checkpoint_json)
                VALUES (?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    spec_json = excluded.spec_json,
                    checkpoint_json = excluded.checkpoint_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    checkpoint.run_id,
                    spec.to_json(),
                    json.dumps(asdict(checkpoint), sort_keys=True, separators=(",", ":")),
                ),
            )
            for event in events or []:
                self._connection.execute(
                    """
                    INSERT INTO workflow_trace(run_id, correlation_id, trace_id, span_id,
                        parent_span_id, step_id, event, attempt, detail_json, at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event["run_id"],
                        event["correlation_id"],
                        event["trace_id"],
                        event["span_id"],
                        event["parent_span_id"],
                        event["step_id"],
                        event["event"],
                        event["attempt"],
                        json.dumps(event["detail"], sort_keys=True, separators=(",", ":")),
                        event["at"],
                    ),
                )

    def load(self, run_id: str) -> tuple[WorkflowSpec, WorkflowCheckpoint]:
        with self._guard:
            row = self._connection.execute(
                "SELECT spec_json, checkpoint_json FROM workflow_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown workflow run: {run_id}")
        spec = WorkflowSpec.from_json(row[0])
        checkpoint = WorkflowCheckpoint(**json.loads(row[1]))
        if not checkpoint.steps:
            _upgrade_legacy_checkpoint(spec, checkpoint)
        return spec, checkpoint

    def request_cancel(self, run_id: str) -> None:
        with self._guard, self._connection:
            cursor = self._connection.execute(
                "UPDATE workflow_runs SET cancel_requested = 1 WHERE run_id = ?", (run_id,)
            )
        if cursor.rowcount == 0:
            raise KeyError(f"Unknown workflow run: {run_id}")

    def cancel_requested(self, run_id: str) -> bool:
        with self._guard:
            row = self._connection.execute(
                "SELECT cancel_requested FROM workflow_runs WHERE run_id = ?", (run_id,)
            ).fetchone()
        return bool(row and row[0])

    def trace(self, run_id: str) -> list[dict[str, Any]]:
        with self._guard:
            rows = self._connection.execute(
                """
                SELECT seq, run_id, correlation_id, trace_id, span_id, parent_span_id, step_id,
                       event, attempt, detail_json, at
                FROM workflow_trace WHERE run_id = ? ORDER BY seq
                """,
                (run_id,),
            ).fetchall()
        return [
            {
                "seq": row[0],
                "run_id": row[1],
                "correlation_id": row[2],
                "trace_id": row[3],
                "span_id": row[4],
                "parent_span_id": row[5],
                "step_id": row[6],
                "event": row[7],
                "attempt": row[8],
                "detail": json.loads(row[9]),
                "at": row[10],
            }
            for row in rows
        ]

    def close(self) -> None:
        self._connection.close()


# =========================================================================== engine


@dataclass(frozen=True, slots=True)
class _Outcome:
    ok: bool
    output: str = ""
    result: dict[str, Any] = field(default_factory=dict)
    code: str | None = None
    message: str | None = None
    retryable: bool = False
    detail: dict[str, Any] = field(default_factory=dict)
    blocked: bool = False


class _ResolutionError(Exception):
    pass


def _digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


class WorkflowEngine:
    """Deterministic durable workflow executor with approval checkpoints."""

    def __init__(
        self,
        registry: ToolRegistry,
        *,
        policy: PermissionPolicy,
        store: SQLiteWorkflowStore,
        specialists: SpecialistRegistry | None = None,
        retry_delay: Callable[[int], float] | None = None,
        default_specialist_timeout_s: float = 30.0,
    ) -> None:
        self.registry = registry
        self.policy = policy
        self.store = store
        self.specialists = specialists or SpecialistRegistry()
        self._retry_delay = retry_delay or RetryPolicy(
            max_attempts=10, base_delay_seconds=0.05, max_delay_seconds=1.0
        ).delay_for_attempt
        if not isfinite(default_specialist_timeout_s) or default_specialist_timeout_s <= 0:
            raise ValueError("default_specialist_timeout_s must be finite and positive.")
        self.default_specialist_timeout_s = default_specialist_timeout_s
        self._locks: dict[str, asyncio.Lock] = {}
        self._inflight: dict[str, asyncio.Task[_Outcome]] = {}

    # ------------------------------------------------------------------ public API

    async def start(
        self,
        spec: WorkflowSpec,
        *,
        session_id: str,
        approved_steps: set[str] | None = None,
        inputs: dict[str, Any] | None = None,
        correlation_id: str | None = None,
    ) -> WorkflowCheckpoint:
        if approved_steps:
            raise ApprovalError(
                "Approvals can only be granted for a step that is awaiting approval "
                "(after its arguments are resolved), not when a workflow starts."
            )
        spec.validate()
        self._preflight(spec)
        inputs = self._validate_inputs(spec, inputs or {})
        if correlation_id is not None and not 1 <= len(correlation_id) <= 128:
            raise WorkflowValidationError("correlation_id must be 1-128 characters.")
        run_id = str(uuid4())
        checkpoint = WorkflowCheckpoint(
            run_id=run_id,
            workflow_name=spec.name,
            session_id=session_id,
            status=RunState.PENDING.value,
            correlation_id=correlation_id or run_id,
            trace_id=new_trace_id(),
            root_span_id=new_span_id(),
            inputs=inputs,
            steps={
                step.id: {
                    "state": StepState.PENDING.value,
                    "attempts": 0,
                    "idempotency_key": None,
                    "span_id": None,
                    "approval_digest": None,
                    "approved": False,
                    "pending_reason": None,
                    "error": None,
                }
                for step in spec.steps
            },
        )
        events = [self._event(checkpoint, "run_created", detail={"workflow": spec.name})]
        self._set_run(checkpoint, RunState.RUNNING, events, "run_started")
        self.store.save(spec, checkpoint, events)
        async with self._lock(run_id):
            return await self._advance(spec, checkpoint, approved=None)

    async def resume(
        self,
        run_id: str,
        *,
        approved_steps: set[str] | None = None,
        approver: str | None = None,
    ) -> WorkflowCheckpoint:
        """Continue a paused run. ``approved_steps`` must name only the awaiting step.

        This is a trusted, server-side entry point: callers must establish who approved
        (see the API's separate approval credential). Approvals are never read from
        workflow arguments, tool output or model output.
        """
        async with self._lock(run_id):
            spec, checkpoint = self.store.load(run_id)
            if checkpoint.status in TERMINAL_RUN_STATES:
                return checkpoint
            if checkpoint.status != RunState.PAUSED:
                raise IllegalTransition(
                    f"Run is {checkpoint.status!r}; only paused runs can be resumed "
                    "(use recover() after an interruption)."
                )
            approved = self._accept_approval(checkpoint, approved_steps or set())
            events: list[dict[str, Any]] = []
            if approved is not None:
                events.append(
                    self._event(
                        checkpoint,
                        "step_approved",
                        step_id=approved,
                        detail={
                            "approver": approver,
                            "approval_digest": checkpoint.steps[approved]["approval_digest"],
                        },
                    )
                )
            self._set_run(checkpoint, RunState.RUNNING, events, "run_resumed")
            checkpoint.pending_step = None
            checkpoint.pending_reason = None
            checkpoint.error = None
            checkpoint.error_code = None
            self.store.save(spec, checkpoint, events)
            return await self._advance(spec, checkpoint, approved=approved)

    async def recover(self, run_id: str) -> WorkflowCheckpoint:
        """Continue a run that was interrupted (process crash) while ``running``.

        Must only be called when no other process is advancing the run; this engine
        assumes a single orchestrator process per store.
        """
        async with self._lock(run_id):
            spec, checkpoint = self.store.load(run_id)
            if checkpoint.status in TERMINAL_RUN_STATES or checkpoint.status == RunState.PAUSED:
                return checkpoint
            events: list[dict[str, Any]] = []
            if checkpoint.status == RunState.PENDING:
                self._set_run(checkpoint, RunState.RUNNING, events, "run_started")
            events.append(self._event(checkpoint, "run_recovered"))
            needs_human: str | None = None
            for step in spec.topological_order():
                record = checkpoint.steps[step.id]
                if record["state"] != StepState.RUNNING:
                    continue
                if await self._safe_to_repeat(step):
                    replays = record.get("recovery_replays", 0)
                    if replays >= _MAX_AUTOMATIC_REPLAYS:
                        return self._fail(
                            spec, checkpoint, step, events, "RECOVERY_BUDGET_EXHAUSTED",
                            "The interrupted step has used its automatic recovery replay.",
                        )
                    record["recovery_replays"] = replays + 1
                    self._set_step(checkpoint, step, StepState.PENDING, events,
                                   "step_recovered", detail={"action": "re-execute"})
                else:
                    self._set_step(checkpoint, step, StepState.UNCERTAIN, events,
                                   "step_outcome_uncertain",
                                   detail={"reason": "interrupted side-effecting step"})
                    needs_human = needs_human or step.id
            if needs_human is not None:
                step = next(item for item in spec.steps if item.id == needs_human)
                record = checkpoint.steps[step.id]
                try:
                    resolved = self._resolve(step.arguments, checkpoint)
                except _ResolutionError as error:  # pragma: no cover - outputs are persisted
                    return self._fail(spec, checkpoint, step, events, "INVALID_REFERENCE",
                                      str(error))
                record["approval_digest"] = _digest(resolved)
                record["approved"] = False
                record["pending_reason"] = "uncertain_side_effect"
                self._set_step(checkpoint, step, StepState.AWAITING_APPROVAL, events,
                               "step_awaiting_approval",
                               detail={"reason": "uncertain_side_effect"})
                self._pause(checkpoint, step, "uncertain_side_effect", events)
                self.store.save(spec, checkpoint, events)
                return checkpoint
            self.store.save(spec, checkpoint, events)
            return await self._advance(spec, checkpoint, approved=None)

    async def cancel(self, run_id: str, *, reason: str = "cancelled") -> WorkflowCheckpoint:
        """Cancel a run. A step in flight in this process is cancelled immediately;
        otherwise the advancing coroutine stops before its next step."""
        _, current = self.store.load(run_id)
        if current.status in TERMINAL_RUN_STATES:
            raise IllegalTransition(f"Run is already {current.status!r}.")
        self.store.request_cancel(run_id)
        raw_lock = self._locks.setdefault(run_id, asyncio.Lock())
        task = self._inflight.get(run_id)
        if task is not None and not task.done():
            task.cancel()
        if raw_lock.locked():
            async with raw_lock:
                pass  # wait until the advancing coroutine has recorded the cancellation
            return self.store.load(run_id)[1]
        async with raw_lock:
            spec, checkpoint = self.store.load(run_id)
            if checkpoint.status in TERMINAL_RUN_STATES:
                return checkpoint
            events: list[dict[str, Any]] = []
            self._cancel_steps(spec, checkpoint, events)
            checkpoint.error = reason[:_MAX_ERROR_CHARS]
            checkpoint.error_code = "CANCELLED"
            checkpoint.pending_step = None
            checkpoint.pending_reason = None
            self._set_run(checkpoint, RunState.CANCELLED, events, "run_cancelled")
            self.store.save(spec, checkpoint, events)
            return checkpoint

    def trace(self, run_id: str) -> list[dict[str, Any]]:
        return self.store.trace(run_id)

    # ------------------------------------------------------------------ validation

    def _run_policy(self, spec: WorkflowSpec) -> PermissionPolicy:
        return PermissionPolicy(
            allowed_tools=self.policy.allowed_tools & spec.permitted_actions(),
            approval_required_tools=self.policy.approval_required_tools,
        )

    def _preflight(self, spec: WorkflowSpec) -> PermissionPolicy:
        policy = self._run_policy(spec)
        for step in spec.steps:
            if step.kind == "tool":
                tool = self.registry.get(step.tool_name)
                if tool is None:
                    raise WorkflowValidationError(
                        f"Workflow references unknown tool: {step.tool_name}"
                    )
                if step.retryable and tool.side_effects and not tool.idempotent:
                    raise WorkflowValidationError(
                        f"Step {step.id}: side-effecting tool {step.tool_name!r} is not "
                        "idempotent and cannot be retried."
                    )
            if step.action not in policy.allowed_tools:
                raise WorkflowValidationError(
                    f"Step {step.id}: action {step.action!r} is not permitted for this workflow."
                )
        return policy

    @staticmethod
    def _validate_inputs(spec: WorkflowSpec, inputs: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(inputs, dict):
            raise WorkflowValidationError("Workflow inputs must be an object.")
        try:
            inputs = json.loads(json.dumps(inputs, allow_nan=False))
        except (TypeError, ValueError) as error:
            raise WorkflowValidationError("Workflow inputs must be strict JSON.") from error
        if spec.input_schema is None:
            if inputs:
                raise WorkflowValidationError("Workflow declares no input_schema; inputs given.")
            return inputs
        errors = list(Draft202012Validator(spec.input_schema).iter_errors(inputs))
        if errors:
            details = sorted(
                f"{'/'.join(str(p) for p in error.absolute_path) or '<root>'}: "
                f"violates '{error.validator}'"
                for error in errors
            )
            raise WorkflowValidationError("Invalid workflow inputs: " + "; ".join(details[:10]))
        return inputs

    # ------------------------------------------------------------------ approvals

    def _accept_approval(self, checkpoint: WorkflowCheckpoint, approved: set[str]) -> str | None:
        if not approved:
            return None
        pending = checkpoint.pending_step
        record = checkpoint.steps.get(pending or "")
        if (
            pending is None
            or record is None
            or record["state"] != StepState.AWAITING_APPROVAL
            or approved != {pending}
        ):
            raise ApprovalError("Approval must name exactly the step that is awaiting approval.")
        return pending

    async def _lookup_operation(self, step: WorkflowStep) -> OperationSpec | CapabilitySnapshot:
        async with asyncio.timeout(step.timeout_s or self.default_specialist_timeout_s):
            return await self.specialists.get(step.specialist or "").operation_spec(
                step.operation or ""
            )

    async def _approval_required(
        self, step: WorkflowStep, spec_policy: PermissionPolicy
    ) -> bool | _Outcome:
        if step.requires_approval or step.action in spec_policy.approval_required_tools:
            return True
        if step.kind == "tool":
            tool = self.registry.get(step.tool_name)
            assert tool is not None  # pre-flighted
            return tool.approval_required
        found = await self._lookup_operation(step)
        if isinstance(found, OperationSpec):
            return found.approval_required
        if not found.available:
            error = found.error or {}
            return _Outcome(
                ok=False,
                code="SPECIALIST_UNAVAILABLE",
                message=str(error.get("message", "Specialist unavailable."))[:_MAX_ERROR_CHARS],
                retryable=bool(error.get("retryable")),
                detail={"unavailable": True, "cause": error.get("code")},
            )
        return _Outcome(
            ok=False,
            code="UNKNOWN_OPERATION",
            message=f"{step.specialist} does not declare operation {step.operation!r}.",
        )

    async def _safe_to_repeat(self, step: WorkflowStep) -> bool:
        if step.kind == "tool":
            tool = self.registry.get(step.tool_name)
            return tool is not None and (not tool.side_effects or tool.idempotent)
        try:
            found = await self._lookup_operation(step)
        except TimeoutError:
            return False
        # Specialist calls carry an Idempotency-Key, but receivers are not required to
        # honour it, so only declared read-only operations are repeated automatically.
        return isinstance(found, OperationSpec) and not found.side_effects

    # ------------------------------------------------------------------ main loop

    async def _advance(
        self,
        spec: WorkflowSpec,
        checkpoint: WorkflowCheckpoint,
        *,
        approved: str | None,
    ) -> WorkflowCheckpoint:
        policy = self._run_policy(spec)
        for step in spec.topological_order():
            record = checkpoint.steps[step.id]
            if record["state"] == StepState.SUCCEEDED:
                continue
            if not all(
                checkpoint.steps[dep]["state"] == StepState.SUCCEEDED for dep in step.depends_on
            ):  # pragma: no cover - sequential order guarantees dependencies ran
                continue
            events: list[dict[str, Any]] = []
            if self.store.cancel_requested(checkpoint.run_id):
                return self._cancel_run(spec, checkpoint, events)
            if step.action not in policy.allowed_tools:
                return self._fail(
                    spec, checkpoint, step, events, "PERMISSION_DENIED",
                    "The action is no longer permitted by the workflow policy.",
                )

            try:
                resolved = self._resolve(step.arguments, checkpoint)
            except _ResolutionError as error:
                return self._fail(spec, checkpoint, step, events, "INVALID_REFERENCE", str(error))
            digest = _digest(resolved)

            try:
                gate = await self._approval_required(step, policy)
            except TimeoutError:
                return self._fail(
                    spec, checkpoint, step, events, "TIMEOUT",
                    "Specialist capability discovery exceeded its timeout.",
                )
            if isinstance(gate, _Outcome):
                return self._fail(spec, checkpoint, step, events, gate.code or "ERROR",
                                  gate.message or "", detail=gate.detail)
            if approved == step.id:
                if record["approval_digest"] is None:  # legacy checkpoint: bind now
                    record["approval_digest"] = digest
                if record["approval_digest"] != digest:
                    return self._fail(spec, checkpoint, step, events, "APPROVAL_MISMATCH",
                                      "Step arguments changed after approval was requested.")
                record["approved"] = True
            # A persisted approval survives crash recovery only for identical arguments.
            is_approved = bool(record.get("approved")) and record["approval_digest"] == digest
            needs_approval = gate or record["state"] == StepState.AWAITING_APPROVAL
            if needs_approval and not is_approved:
                if record["state"] != StepState.AWAITING_APPROVAL:
                    record["approval_digest"] = digest
                    record["approved"] = False
                    record["pending_reason"] = "approval_required"
                    self._set_step(checkpoint, step, StepState.AWAITING_APPROVAL, events,
                                   "step_awaiting_approval",
                                   detail={"approval_digest": digest})
                self._pause(checkpoint, step, record["pending_reason"] or "approval_required",
                            events)
                self.store.save(spec, checkpoint, events)
                return checkpoint

            key = record["idempotency_key"] or (
                "makma-" + _digest([checkpoint.run_id, step.id, digest])[:40]
            )
            record["idempotency_key"] = key
            while True:
                attempt = record["attempts"] + 1
                record["attempts"] = attempt
                record["pending_reason"] = None
                self._set_step(checkpoint, step, StepState.RUNNING, events, "step_started",
                               detail={"action": step.action, "idempotency_key": key,
                                       "arguments_sha256": digest})
                # Commit the intent before executing so a crash leaves evidence.
                self.store.save(spec, checkpoint, events)
                events = []

                task = asyncio.ensure_future(
                    self._execute_once(step, resolved, checkpoint, policy, key, is_approved)
                )
                self._inflight[checkpoint.run_id] = task
                try:
                    outcome = await task
                except asyncio.CancelledError:
                    if not self.store.cancel_requested(checkpoint.run_id):
                        raise
                    events.append(self._event(checkpoint, "step_interrupted", step_id=step.id,
                                              detail={"outcome_uncertain": True}))
                    return self._cancel_run(spec, checkpoint, events)
                finally:
                    self._inflight.pop(checkpoint.run_id, None)

                if outcome.ok:
                    checkpoint.results[step.id] = outcome.result
                    checkpoint.outputs[step.id] = outcome.output
                    checkpoint.completed_steps.append(step.id)
                    record["error"] = None
                    self._set_step(
                        checkpoint, step, StepState.SUCCEEDED, events, "step_succeeded",
                        detail={
                            "output_sha256": hashlib.sha256(
                                outcome.output.encode("utf-8")
                            ).hexdigest(),
                            **outcome.detail,
                        },
                    )
                    checkpoint.pending_step = None
                    self.store.save(spec, checkpoint, events)
                    break

                error_detail = {"code": outcome.code, "message": outcome.message,
                                "retryable": outcome.retryable, **outcome.detail}
                events.append(self._event(checkpoint, "step_attempt_failed", step_id=step.id,
                                          detail=error_detail))
                if step.retryable and outcome.retryable and attempt < step.max_attempts:
                    record["error"] = outcome.message
                    self._set_step(checkpoint, step, StepState.PENDING, events,
                                   "step_retry_scheduled", detail={"next_attempt": attempt + 1})
                    self.store.save(spec, checkpoint, events)
                    events = []
                    await asyncio.sleep(self._retry_delay(attempt))
                    if self.store.cancel_requested(checkpoint.run_id):
                        return self._cancel_run(spec, checkpoint, events)
                    continue
                return self._fail(spec, checkpoint, step, events, outcome.code or "ERROR",
                                  outcome.message or "", detail=outcome.detail,
                                  blocked=outcome.blocked)
            approved = None if approved == step.id else approved

        events = []
        checkpoint.pending_step = None
        self._set_run(checkpoint, RunState.SUCCEEDED, events, "run_succeeded")
        self.store.save(spec, checkpoint, events)
        return checkpoint

    async def _execute_once(
        self,
        step: WorkflowStep,
        resolved: dict[str, Any],
        checkpoint: WorkflowCheckpoint,
        policy: PermissionPolicy,
        key: str,
        approved: bool,
    ) -> _Outcome:
        try:
            if step.kind == "tool":
                return await self._execute_tool(step, resolved, checkpoint, policy, key, approved)
            return await self._execute_specialist(step, resolved, checkpoint, key, approved)
        except TimeoutError:
            return _Outcome(ok=False, code="TIMEOUT",
                            message=f"Step exceeded its {step.timeout_s}s timeout.",
                            retryable=True)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            return _Outcome(ok=False, code="STEP_EXCEPTION",
                            message=f"{type(error).__name__}: {error}"[:_MAX_ERROR_CHARS],
                            retryable=True)

    async def _execute_tool(
        self,
        step: WorkflowStep,
        resolved: dict[str, Any],
        checkpoint: WorkflowCheckpoint,
        policy: PermissionPolicy,
        key: str,
        approved: bool,
    ) -> _Outcome:
        with idempotency_scope(key):
            async with asyncio.timeout(step.timeout_s):
                result = await self.registry.execute(
                    step.tool_name,
                    resolved,
                    session_id=checkpoint.session_id,
                    policy=policy,
                    approvals={step.tool_name} if approved else set(),
                )
        if not result.ok:
            # Permission and schema failures are deterministic: never retried.
            return _Outcome(ok=False, code="TOOL_REJECTED",
                            message=(result.error or "Tool execution failed.")[:_MAX_ERROR_CHARS])
        return _Outcome(
            ok=True,
            output=result.output,
            result={
                "kind": "tool",
                "tool_name": result.tool_name,
                "output": result.output,
                "trusted": result.trusted,
                "provenance": result.provenance,
            },
        )

    async def _execute_specialist(
        self,
        step: WorkflowStep,
        resolved: dict[str, Any],
        checkpoint: WorkflowCheckpoint,
        key: str,
        approved: bool,
    ) -> _Outcome:
        adapter = self.specialists.get(step.specialist or "")
        if step.approval_argument is not None and approved:
            # Translation of an approval this engine recorded into the specialist's own
            # flag. Never taken from workflow arguments (rejected at validation).
            resolved = {**resolved, step.approval_argument: True}
        found = await self._lookup_operation(step)
        if not isinstance(found, OperationSpec):  # pragma: no cover - checked at gate
            return _Outcome(ok=False, code="SPECIALIST_UNAVAILABLE",
                            message="Specialist capabilities are unavailable.", retryable=True)
        if step.retryable and found.side_effects:
            return _Outcome(
                ok=False, code="UNSAFE_RETRY",
                message="A side-effecting specialist operation cannot be retried.",
            )
        violations = sorted(
            f"{'/'.join(str(p) for p in error.absolute_path) or '<root>'}: "
            f"violates '{error.validator}'"
            for error in Draft202012Validator(found.input_schema).iter_errors(resolved)
        )
        if violations:
            return _Outcome(ok=False, code="INVALID_INPUT",
                            message="Arguments do not match the specialist input schema.",
                            detail={"violations": violations[:20]})
        timeout = step.timeout_s or found.timeout_s or self.default_specialist_timeout_s
        span_id = checkpoint.steps[step.id]["span_id"]
        outcome: SpecialistOutcome = await adapter.call(
            step.operation or "",
            resolved,
            run_id=checkpoint.run_id,
            correlation_id=checkpoint.correlation_id,
            idempotency_key=key,
            trace=TraceContext(checkpoint.trace_id, span_id),
            timeout_s=timeout,
            # The durable workflow is the sole retry owner for a workflow step.
            # Each recorded attempt issues at most one specialist invocation.
            # The adapter still supports independent retries outside workflows.
            retry_safe=False,
        )
        detail: dict[str, Any] = {
            "specialist": outcome.system,
            "operation": outcome.operation,
            "specialist_status": outcome.status,
            "transport_attempts": outcome.attempts,
        }
        if outcome.envelope is not None:
            detail["specialist_trace_id"] = outcome.envelope["trace_id"]
            detail["specialist_span_id"] = outcome.envelope["span_id"]
            detail["execution_mode"] = outcome.envelope["execution_mode"]
        if step.approval_argument is not None:
            detail["approval_argument_set"] = bool(approved)
        accepted_pending = (
            outcome.status == "pending_approval"
            and step.accept_pending_approval
            and outcome.envelope is not None
        )
        if accepted_pending:
            policy = outcome.envelope.get("policy") or {}
            detail["specialist_requires_approval"] = True
            detail["specialist_policy_reasons"] = list(policy.get("reasons", []))
        if (outcome.ok or accepted_pending) and outcome.envelope is not None:
            return _Outcome(
                ok=True,
                output=canonical_json(outcome.envelope),
                result={"kind": "specialist", "envelope": outcome.envelope},
                detail=detail,
            )
        error = outcome.error or {}
        code = str(error.get("code") or outcome.status.upper())
        if outcome.status == "pending_approval":
            code = "SPECIALIST_REQUIRES_APPROVAL"
            policy = (outcome.envelope or {}).get("policy") or {}
            detail["specialist_policy_reasons"] = list(policy.get("reasons", []))
        elif outcome.status == "blocked":
            # Keep the specialist's own code (e.g. POLICY_DENIED); the run ends BLOCKED.
            policy = (outcome.envelope or {}).get("policy") or {}
            detail["specialist_policy_reasons"] = list(policy.get("reasons", []))
            detail["specialist_error_details"] = error.get("details", {})
            return _Outcome(
                ok=False,
                code=code,
                message=str(error.get("message") or "Specialist blocked the operation.")[
                    :_MAX_ERROR_CHARS
                ],
                detail=detail,
                blocked=True,
            )
        elif outcome.status == "unavailable":
            detail["unavailable"] = True
        return _Outcome(
            ok=False,
            code=code,
            message=str(error.get("message") or f"Specialist returned {outcome.status}.")[
                :_MAX_ERROR_CHARS
            ],
            retryable=outcome.retryable and outcome.status in {"error", "unavailable"},
            detail=detail,
        )

    # ------------------------------------------------------------------ data flow

    @staticmethod
    def _resolve(value: Any, checkpoint: WorkflowCheckpoint) -> Any:
        if isinstance(value, str):
            match = _REF_RE.fullmatch(value)
            if not match:
                return value
            head = match.group("head")
            path = [part for part in match.group("path").split(".") if part]
            if match.group("scope") == "inputs":
                if head not in checkpoint.inputs:
                    raise _ResolutionError(f"Workflow input {head!r} was not supplied.")
                current: Any = checkpoint.inputs[head]
            else:
                if head not in checkpoint.outputs:
                    raise _ResolutionError(f"Workflow output is not available yet: {head}")
                if path[0] == "output":
                    return checkpoint.outputs[head]
                path = path[1:]
                result = checkpoint.results.get(head, {})
                if result.get("kind") == "specialist":
                    current = result["envelope"]["data"]
                else:
                    try:
                        current = json.loads(checkpoint.outputs[head])
                    except ValueError as error:
                        raise _ResolutionError(f"Output of {head!r} is not JSON.") from error
            for part in path:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
                    current = current[int(part)]
                else:
                    raise _ResolutionError(f"Reference path {value!r} does not exist.")
            return current
        if isinstance(value, list):
            return [WorkflowEngine._resolve(item, checkpoint) for item in value]
        if isinstance(value, dict):
            return {key: WorkflowEngine._resolve(item, checkpoint) for key, item in value.items()}
        return value

    # ------------------------------------------------------------------ helpers

    def _lock(self, run_id: str) -> _RunLock:
        lock = self._locks.setdefault(run_id, asyncio.Lock())
        return _RunLock(lock)

    def _event(
        self,
        checkpoint: WorkflowCheckpoint,
        event: str,
        *,
        step_id: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = checkpoint.steps.get(step_id) if step_id else None
        return {
            "run_id": checkpoint.run_id,
            "correlation_id": checkpoint.correlation_id,
            "trace_id": checkpoint.trace_id,
            "span_id": (record or {}).get("span_id") or checkpoint.root_span_id,
            "parent_span_id": checkpoint.root_span_id if record else None,
            "step_id": step_id,
            "event": event,
            "attempt": (record or {}).get("attempts"),
            "detail": detail or {},
            "at": _now(),
        }

    def _set_run(
        self,
        checkpoint: WorkflowCheckpoint,
        new: RunState,
        events: list[dict[str, Any]],
        event: str,
    ) -> None:
        check_run_transition(checkpoint.status, new)
        checkpoint.status = new.value
        events.append(self._event(checkpoint, event, detail={"status": new.value}))

    def _set_step(
        self,
        checkpoint: WorkflowCheckpoint,
        step: WorkflowStep,
        new: StepState,
        events: list[dict[str, Any]],
        event: str,
        *,
        detail: dict[str, Any] | None = None,
    ) -> None:
        record = checkpoint.steps[step.id]
        check_step_transition(record["state"], new)
        record["state"] = new.value
        if record.get("span_id") is None:
            record["span_id"] = new_span_id()  # one span per step, shared by its attempts
        events.append(self._event(checkpoint, event, step_id=step.id, detail=detail))

    def _pause(
        self,
        checkpoint: WorkflowCheckpoint,
        step: WorkflowStep,
        reason: str,
        events: list[dict[str, Any]],
    ) -> None:
        checkpoint.pending_step = step.id
        checkpoint.pending_reason = reason
        if checkpoint.status != RunState.PAUSED:
            self._set_run(checkpoint, RunState.PAUSED, events, "run_paused")

    def _fail(
        self,
        spec: WorkflowSpec,
        checkpoint: WorkflowCheckpoint,
        step: WorkflowStep,
        events: list[dict[str, Any]],
        code: str,
        message: str,
        *,
        detail: dict[str, Any] | None = None,
        blocked: bool = False,
    ) -> WorkflowCheckpoint:
        record = checkpoint.steps[step.id]
        record["error"] = message[:_MAX_ERROR_CHARS]
        self._set_step(checkpoint, step, StepState.BLOCKED if blocked else StepState.FAILED,
                       events, "step_blocked" if blocked else "step_failed",
                       detail={"code": code, "message": message[:_MAX_ERROR_CHARS],
                               **(detail or {})})
        checkpoint.pending_step = step.id
        checkpoint.pending_reason = None
        checkpoint.error = message[:_MAX_ERROR_CHARS] or code
        checkpoint.error_code = code
        if blocked:
            self._set_run(checkpoint, RunState.BLOCKED, events, "run_blocked")
        else:
            self._set_run(checkpoint, RunState.FAILED, events, "run_failed")
        self.store.save(spec, checkpoint, events)
        return checkpoint

    def _cancel_steps(
        self, spec: WorkflowSpec, checkpoint: WorkflowCheckpoint, events: list[dict[str, Any]]
    ) -> None:
        for step in spec.topological_order():
            state = checkpoint.steps[step.id]["state"]
            if state in {
                StepState.SUCCEEDED, StepState.FAILED, StepState.BLOCKED, StepState.CANCELLED
            }:
                continue
            detail = {"outcome_uncertain": state in {StepState.RUNNING, StepState.UNCERTAIN}}
            self._set_step(checkpoint, step, StepState.CANCELLED, events, "step_cancelled",
                           detail=detail)

    def _cancel_run(
        self, spec: WorkflowSpec, checkpoint: WorkflowCheckpoint, events: list[dict[str, Any]]
    ) -> WorkflowCheckpoint:
        self._cancel_steps(spec, checkpoint, events)
        checkpoint.error = "Workflow was cancelled."
        checkpoint.error_code = "CANCELLED"
        checkpoint.pending_step = None
        checkpoint.pending_reason = None
        self._set_run(checkpoint, RunState.CANCELLED, events, "run_cancelled")
        self.store.save(spec, checkpoint, events)
        return checkpoint


class _RunLock:
    """Non-blocking per-run lock: a second concurrent advance is rejected, not queued."""

    def __init__(self, lock: asyncio.Lock) -> None:
        self._lock = lock

    def locked(self) -> bool:
        return self._lock.locked()

    async def __aenter__(self) -> None:
        if self._lock.locked():
            raise WorkflowBusy("Workflow run is already being advanced.")
        await self._lock.acquire()

    async def __aexit__(self, *exc: object) -> None:
        self._lock.release()
