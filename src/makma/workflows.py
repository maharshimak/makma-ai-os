from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path
from uuid import uuid4

from makma.tools import PermissionPolicy, ToolRegistry


@dataclass(frozen=True, slots=True)
class WorkflowStep:
    id: str
    tool_name: str
    arguments: dict[str, object] = field(default_factory=dict)
    depends_on: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class WorkflowSpec:
    name: str
    steps: tuple[WorkflowStep, ...]

    def validate(self) -> None:
        if not self.name.strip() or not self.steps:
            raise ValueError("Workflow requires a name and at least one step.")
        ids = [step.id for step in self.steps]
        if len(ids) != len(set(ids)) or any(not step_id.strip() for step_id in ids):
            raise ValueError("Workflow step IDs must be unique non-empty strings.")
        known = set(ids)
        for step in self.steps:
            if not step.tool_name.strip():
                raise ValueError("Workflow tools must be non-empty.")
            unknown = set(step.depends_on) - known
            if unknown:
                raise ValueError(f"Unknown dependencies for {step.id}: {sorted(unknown)}")
            if step.id in step.depends_on:
                raise ValueError("A workflow step cannot depend on itself.")
        self.topological_order()

    def topological_order(self) -> tuple[WorkflowStep, ...]:
        by_id = {step.id: step for step in self.steps}
        remaining = set(by_id)
        resolved: set[str] = set()
        ordered: list[WorkflowStep] = []
        while remaining:
            ready = sorted(
                (
                    by_id[step_id]
                    for step_id in remaining
                    if set(by_id[step_id].depends_on) <= resolved
                ),
                key=lambda step: step.id,
            )
            if not ready:
                raise ValueError("Workflow dependency graph contains a cycle.")
            for step in ready:
                ordered.append(step)
                resolved.add(step.id)
                remaining.remove(step.id)
        return tuple(ordered)


@dataclass(slots=True)
class WorkflowCheckpoint:
    run_id: str
    workflow_name: str
    session_id: str
    status: str = "running"
    completed_steps: list[str] = field(default_factory=list)
    outputs: dict[str, str] = field(default_factory=dict)
    pending_step: str | None = None
    error: str | None = None


class SQLiteWorkflowStore:
    """Durable workflow checkpoints for resume, inspection and fault recovery."""

    def __init__(self, path: str) -> None:
        self.path = path
        if path != ":memory:":
            Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path)
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
        self._connection.commit()

    def save(self, spec: WorkflowSpec, checkpoint: WorkflowCheckpoint) -> None:
        spec_payload = {
            "name": spec.name,
            "steps": [asdict(step) for step in spec.steps],
        }
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
                json.dumps(spec_payload, sort_keys=True, separators=(",", ":")),
                json.dumps(asdict(checkpoint), sort_keys=True, separators=(",", ":")),
            ),
        )
        self._connection.commit()

    def load(self, run_id: str) -> tuple[WorkflowSpec, WorkflowCheckpoint]:
        row = self._connection.execute(
            "SELECT spec_json, checkpoint_json FROM workflow_runs WHERE run_id = ?",
            (run_id,),
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown workflow run: {run_id}")
        raw_spec = json.loads(row[0])
        spec = WorkflowSpec(
            name=raw_spec["name"],
            steps=tuple(
                WorkflowStep(
                    id=item["id"],
                    tool_name=item["tool_name"],
                    arguments=item.get("arguments", {}),
                    depends_on=tuple(item.get("depends_on", ())),
                )
                for item in raw_spec["steps"]
            ),
        )
        checkpoint = WorkflowCheckpoint(**json.loads(row[1]))
        return spec, checkpoint

    def close(self) -> None:
        self._connection.close()


class WorkflowEngine:
    """Deterministic durable tool workflow executor with approval checkpoints."""

    def __init__(
        self,
        registry: ToolRegistry,
        *,
        policy: PermissionPolicy,
        store: SQLiteWorkflowStore,
    ) -> None:
        self.registry = registry
        self.policy = policy
        self.store = store

    def _approval_required(self, tool_name: str) -> bool:
        for tool in self.registry.describe():
            if tool["name"] == tool_name:
                return bool(
                    tool["requires_approval"]
                    or tool["side_effects"]
                    or tool["risk_level"] == "high"
                    or tool_name in self.policy.approval_required_tools
                )
        raise ValueError(f"Workflow references unknown tool: {tool_name}")

    async def start(
        self,
        spec: WorkflowSpec,
        *,
        session_id: str,
        approvals: set[str] | None = None,
    ) -> WorkflowCheckpoint:
        spec.validate()
        checkpoint = WorkflowCheckpoint(
            run_id=str(uuid4()),
            workflow_name=spec.name,
            session_id=session_id,
        )
        self.store.save(spec, checkpoint)
        return await self._advance(spec, checkpoint, approvals or set())

    async def resume(
        self,
        run_id: str,
        *,
        approvals: set[str] | None = None,
    ) -> WorkflowCheckpoint:
        spec, checkpoint = self.store.load(run_id)
        if checkpoint.status in {"succeeded", "failed"}:
            return checkpoint
        checkpoint.status = "running"
        checkpoint.pending_step = None
        checkpoint.error = None
        self.store.save(spec, checkpoint)
        return await self._advance(spec, checkpoint, approvals or set())

    async def _advance(
        self,
        spec: WorkflowSpec,
        checkpoint: WorkflowCheckpoint,
        approvals: set[str],
    ) -> WorkflowCheckpoint:
        completed = set(checkpoint.completed_steps)
        for step in spec.topological_order():
            if step.id in completed:
                continue
            if not set(step.depends_on) <= completed:
                continue
            if self._approval_required(step.tool_name) and step.tool_name not in approvals:
                checkpoint.status = "paused"
                checkpoint.pending_step = step.id
                self.store.save(spec, checkpoint)
                return checkpoint

            result = await self.registry.execute(
                step.tool_name,
                step.arguments,
                session_id=checkpoint.session_id,
                policy=self.policy,
                approvals=approvals,
            )
            if not result.ok:
                checkpoint.status = "failed"
                checkpoint.pending_step = step.id
                checkpoint.error = result.error or "Tool execution failed."
                self.store.save(spec, checkpoint)
                return checkpoint

            checkpoint.completed_steps.append(step.id)
            checkpoint.outputs[step.id] = result.output
            checkpoint.pending_step = None
            completed.add(step.id)
            self.store.save(spec, checkpoint)

        checkpoint.status = "succeeded"
        checkpoint.pending_step = None
        self.store.save(spec, checkpoint)
        return checkpoint
