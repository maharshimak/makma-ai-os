import asyncio
import sqlite3
from contextlib import closing

import pytest
from test_workflow_engine import Harness, SimulatedCrash

from makma.resilience import RetryPolicy
from makma.specialists import (
    CapabilitySnapshot,
    OperationSpec,
    SpecialistAdapter,
    SpecialistOutcome,
    SpecialistRegistry,
)
from makma.tools import PermissionPolicy, ToolRegistry
from makma.workflows import (
    SQLiteWorkflowStore,
    WorkflowEngine,
    WorkflowSpec,
    WorkflowStep,
    WorkflowValidationError,
)


class TransientSpecialist(SpecialistAdapter):
    def __init__(self, *, mutates=False, slow_discovery=False):
        super().__init__(
            "agentic-rag-engine",
            retry=RetryPolicy(max_attempts=4, base_delay_seconds=0),
        )
        self.calls = []
        self.mutates = mutates
        self.slow_discovery = slow_discovery

    async def _fetch_capabilities(self):
        if self.slow_discovery:
            await asyncio.sleep(1)
        return CapabilitySnapshot(
            self.system,
            True,
            operations={"retrieve": OperationSpec("retrieve", self.mutates, False, {}, None)},
        )

    async def _invoke(self, operation, payload, **kwargs):
        self.calls.append(kwargs["idempotency_key"])
        return SpecialistOutcome(
            self.system,
            operation,
            "error",
            error={"code": "TRANSIENT", "message": "transient failure", "retryable": True},
        )


def specialist_engine(adapter):
    return WorkflowEngine(
        ToolRegistry(),
        policy=PermissionPolicy(allowed_tools=frozenset({"agentic-rag-engine.retrieve"})),
        store=SQLiteWorkflowStore(":memory:"),
        specialists=SpecialistRegistry([adapter]),
        retry_delay=lambda _: 0,
    )


def specialist_workflow(**kwargs):
    return WorkflowSpec(
        "test",
        (
            WorkflowStep(
                "one",
                specialist="agentic-rag-engine",
                operation="retrieve",
                **kwargs,
            ),
        ),
    )


@pytest.mark.asyncio
async def test_workflow_attempts_are_not_multiplied_by_adapter_retries():
    adapter = TransientSpecialist()
    engine = specialist_engine(adapter)
    try:
        result = await engine.start(
            specialist_workflow(retryable=True, max_attempts=2), session_id="s"
        )
        assert result.error_code == "TRANSIENT"
        assert result.steps["one"]["attempts"] == 2
        assert len(adapter.calls) == 2
        assert adapter.calls[0] == adapter.calls[1]
    finally:
        engine.store.close()


@pytest.mark.asyncio
async def test_approval_does_not_permit_retrying_side_effecting_specialists():
    adapter = TransientSpecialist(mutates=True)
    engine = specialist_engine(adapter)
    try:
        paused = await engine.start(
            specialist_workflow(retryable=True, max_attempts=2), session_id="s"
        )
        assert paused.status == "paused"
        result = await engine.resume(paused.run_id, approved_steps={"one"}, approver="reviewer")
        assert result.error_code == "UNSAFE_RETRY"
        assert adapter.calls == []
    finally:
        engine.store.close()


@pytest.mark.asyncio
async def test_capability_discovery_obeys_step_timeout():
    engine = specialist_engine(TransientSpecialist(slow_discovery=True))
    try:
        async with asyncio.timeout(0.5):
            result = await engine.start(specialist_workflow(timeout_s=0.02), session_id="s")
        assert result.error_code == "TIMEOUT"
        assert result.steps["one"]["attempts"] == 0
    finally:
        engine.store.close()


@pytest.mark.asyncio
async def test_paused_run_respects_revoked_specialist_permission():
    adapter = TransientSpecialist(mutates=True)
    engine = specialist_engine(adapter)
    try:
        paused = await engine.start(specialist_workflow(), session_id="s")
        assert paused.status == "paused"
        engine.policy = PermissionPolicy(allowed_tools=frozenset())
        result = await engine.resume(paused.run_id, approved_steps={"one"}, approver="reviewer")
        assert result.error_code == "PERMISSION_DENIED"
        assert adapter.calls == []
    finally:
        engine.store.close()


@pytest.mark.asyncio
async def test_one_automatic_replay_survives_process_reopen(tmp_path):
    path = str(tmp_path / "workflow.db")
    harness = Harness()

    async def read(args, session_id):
        return "complete"

    harness.add("read", read)
    first = harness.engine(path)
    harness.crash_on.add("read")
    with pytest.raises(SimulatedCrash):
        await first.start(WorkflowSpec("test", (WorkflowStep("one", "read"),)), session_id="s")
    first.store.close()
    with closing(sqlite3.connect(path)) as connection:
        run_id = connection.execute("SELECT run_id FROM workflow_runs").fetchone()[0]

    second = harness.engine(path)
    harness.crash_on.add("read")
    with pytest.raises(SimulatedCrash):
        await second.recover(run_id)
    second.store.close()

    third = harness.engine(path)
    try:
        result = await third.recover(run_id)
        assert result.error_code == "RECOVERY_BUDGET_EXHAUSTED"
        assert result.status == "failed"
        assert harness.calls["read"] == 2
        assert len(set(harness.keys["read"])) == 1
        assert third.trace(run_id)[-1]["event"] == "run_failed"
    finally:
        third.store.close()


def test_topology_keeps_wave_order_and_coalesces_duplicate_dependencies():
    steps = (
        WorkflowStep("z", "tool"),
        WorkflowStep("b", "tool", depends_on=("a", "a")),
        WorkflowStep("a", "tool"),
        WorkflowStep("c", "tool", depends_on=("z", "b")),
    )
    spec = WorkflowSpec("waves", steps)
    assert [step.id for step in spec.topological_order()] == ["a", "z", "b", "c"]
    assert WorkflowSpec.from_json(spec.to_json()).topological_order() == spec.topological_order()


def test_library_rejects_workflows_over_the_step_limit():
    spec = WorkflowSpec("large", tuple(WorkflowStep(str(i), "tool") for i in range(513)))
    with pytest.raises(WorkflowValidationError, match="512 steps"):
        spec.validate()
