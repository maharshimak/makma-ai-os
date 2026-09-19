from makma.planner import Planner


def test_planner_emits_ordered_multi_tool_plan() -> None:
    plan = Planner().plan(
        "search my memory for project atlas and calculate 6 * 7"
    )

    assert [step.tool_name for step in plan if step.kind == "tool"] == [
        "memory_search",
        "calculator",
    ]
    assert plan[-1].kind == "respond"
    assert plan[0].arguments["query"] == "project atlas"
    assert plan[1].arguments["expression"] == "6 * 7"


def test_planner_preserves_pure_math_shortcut() -> None:
    plan = Planner().plan("19 * 23")

    assert plan[0].kind == "tool"
    assert plan[0].tool_name == "calculator"
    assert plan[0].arguments["expression"] == "19 * 23"
    assert plan[-1].kind == "respond"
