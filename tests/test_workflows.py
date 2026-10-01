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

    resumed = await engine.resume(paused.run_id, approved_steps={"b"})
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
async def test_workflow_dependency_output_is_real_dataflow(tmp_path):
    async def source(args, session_id):
        del args, session_id
        return "generated-value"

    async def sink(args, session_id):
        return f"{args['value']}:{session_id}"

    registry = ToolRegistry()
    registry.register(ToolDefinition(name="source", description="source", handler=source))
    registry.register(ToolDefinition(name="sink", description="sink", handler=sink))
    policy = PermissionPolicy(allowed_tools=frozenset({"source", "sink"}))
    store = SQLiteWorkflowStore(str(tmp_path / "dataflow.sqlite"))
    engine = WorkflowEngine(registry, policy=policy, store=store)
    spec = WorkflowSpec(
        "dataflow",
        (
            WorkflowStep("fetch", "source"),
            WorkflowStep(
                "consume",
                "sink",
                {"value": "${steps.fetch.output}"},
                depends_on=("fetch",),
            ),
        ),
    )

    result = await engine.start(spec, session_id="s2")

    assert result.status == "succeeded"
    assert result.outputs["consume"] == "generated-value:s2"


@pytest.mark.asyncio
async def test_approval_is_bound_to_one_step_not_every_use_of_tool(tmp_path):
    async def risky(args, session_id):
        return f"{args['value']}:{session_id}"

    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="risky",
            description="risky",
            handler=risky,
            requires_approval=True,
            side_effects=True,
        )
    )
    policy = PermissionPolicy(allowed_tools=frozenset({"risky"}))
    store = SQLiteWorkflowStore(str(tmp_path / "approval.sqlite"))
    engine = WorkflowEngine(registry, policy=policy, store=store)
    spec = WorkflowSpec(
        "two-risky-steps",
        (
            WorkflowStep("first", "risky", {"value": 1}),
            WorkflowStep("second", "risky", {"value": 2}, depends_on=("first",)),
        ),
    )

    paused = await engine.start(spec, session_id="s3")
    first = await engine.resume(paused.run_id, approved_steps={"first"})

    assert first.status == "paused"
    assert first.completed_steps == ["first"]
    assert first.pending_step == "second"
