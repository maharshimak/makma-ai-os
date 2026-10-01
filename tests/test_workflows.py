import pytest

from makma.tools import PermissionPolicy, ToolDefinition, ToolRegistry
from makma.workflows import SQLiteWorkflowStore, WorkflowEngine, WorkflowSpec, WorkflowStep


@pytest.mark.asyncio
async def test_workflow_pauses_and_resumes_for_approval(tmp_path):
    async def safe(args, session_id):
        return f"safe:{args['value']}:{session_id}"

    async def risky(args, session_id):
        return f"risky:{args['value']}:{session_id}"

    registry = ToolRegistry()
    registry.register(ToolDefinition(name="safe", description="safe", handler=safe))
    registry.register(
        ToolDefinition(
            name="risky",
            description="risky",
            handler=risky,
            requires_approval=True,
            side_effects=True,
        )
    )
    policy = PermissionPolicy(allowed_tools=frozenset({"safe", "risky"}))
    store = SQLiteWorkflowStore(str(tmp_path / "workflows.sqlite"))
    engine = WorkflowEngine(registry, policy=policy, store=store)
    spec = WorkflowSpec(
        "demo",
        (
            WorkflowStep("a", "safe", {"value": 1}),
            WorkflowStep("b", "risky", {"value": 2}, depends_on=("a",)),
        ),
    )

    paused = await engine.start(spec, session_id="s1")
    assert paused.status == "paused"
    assert paused.completed_steps == ["a"]
    assert paused.pending_step == "b"

    resumed = await engine.resume(paused.run_id, approvals={"risky"})
    assert resumed.status == "succeeded"
    assert resumed.completed_steps == ["a", "b"]
    assert resumed.outputs["b"] == "risky:2:s1"


def test_workflow_rejects_dependency_cycles():
    spec = WorkflowSpec(
        "cycle",
        (
            WorkflowStep("a", "one", depends_on=("b",)),
            WorkflowStep("b", "two", depends_on=("a",)),
        ),
    )
    with pytest.raises(ValueError, match="cycle"):
        spec.validate()



@pytest.mark.asyncio
async def test_workflow_resolves_declared_step_output_dependencies(tmp_path):
    async def produce(args, session_id):
        del args, session_id
        return "customer-42"

    async def consume(args, session_id):
        del session_id
        return f"received:{args['customer_id']}"

    registry = ToolRegistry()
    registry.register(ToolDefinition(name="produce", description="produce", handler=produce))
    registry.register(ToolDefinition(name="consume", description="consume", handler=consume))
    policy = PermissionPolicy(allowed_tools=frozenset({"produce", "consume"}))
    store = SQLiteWorkflowStore(str(tmp_path / "dataflow.sqlite"))
    engine = WorkflowEngine(registry, policy=policy, store=store)
    spec = WorkflowSpec(
        "dataflow",
        (
            WorkflowStep("a", "produce"),
            WorkflowStep(
                "b",
                "consume",
                {"customer_id": "${steps.a.output}"},
                depends_on=("a",),
            ),
        ),
    )

    result = await engine.start(spec, session_id="s1")

    assert result.status == "succeeded"
    assert result.outputs["b"] == "received:customer-42"


def test_workflow_rejects_output_reference_without_declared_dependency():
    spec = WorkflowSpec(
        "invalid-dataflow",
        (
            WorkflowStep("a", "one"),
            WorkflowStep("b", "two", {"value": "${steps.a.output}"}),
        ),
    )

    with pytest.raises(ValueError, match="without declaring dependencies"):
        spec.validate()
