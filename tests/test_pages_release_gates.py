"""Source-level regressions for the manual GitHub Pages release gate.

These tests do not replace GitHub environment/branch protection settings.
"""

import re
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "pages.yml"
REQUIRED_GATE = (
    "github.event_name == 'workflow_dispatch' && "
    "github.ref == 'refs/heads/main' && "
    "inputs.confirm_production_deploy == true"
)


def _job_body(workflow: str, name: str) -> str:
    jobs = workflow.split("\njobs:\n", maxsplit=1)[1]
    match = re.search(rf"(?m)^  {re.escape(name)}:\n", jobs)
    assert match is not None, f"Missing workflow job: {name}"
    rest = jobs[match.end() :]
    next_job = re.search(r"(?m)^  [a-z][a-z0-9-]*:\n", rest)
    return rest[: next_job.start()] if next_job else rest


def test_manual_production_release_defaults_to_opt_out():
    content = WORKFLOW.read_text(encoding="utf-8")
    dispatch = re.search(
        r"(?m)^  workflow_dispatch:\n"
        r"    inputs:\n"
        r"      confirm_production_deploy:\n(?P<properties>(?:        .+\n)+)",
        content,
    )
    assert dispatch is not None, "Manual release confirmation input is missing"
    properties = dispatch.group("properties")
    assert "required: true" in properties
    assert "type: boolean" in properties
    assert "default: false" in properties


def test_release_steps_require_approved_main_branch_dispatch():
    content = WORKFLOW.read_text(encoding="utf-8")
    verify = _job_body(content, "verify")

    for step in ("Configure Pages", "Upload verified site"):
        match = re.search(
            rf"(?m)^      - name: {re.escape(step)}\n"
            r"        if: (?P<condition>.+)$",
            verify,
        )
        assert match is not None, f"{step} must have an explicit release gate"
        assert match.group("condition") == REQUIRED_GATE

    assert "pages: write" not in verify
    assert "id-token: write" not in verify


def test_deploy_and_production_browser_checks_remain_manual_only():
    content = WORKFLOW.read_text(encoding="utf-8")
    deploy = _job_body(content, "deploy")
    live_e2e = _job_body(content, "live-e2e")
    assert deploy.startswith(f"    if: {REQUIRED_GATE}\n")
    assert live_e2e.startswith(f"    if: {REQUIRED_GATE}\n")
    assert "needs: verify" in deploy
    assert "needs: deploy" in live_e2e
    assert "environment:\n      name: github-pages" in deploy
    assert "actions/deploy-pages@" in deploy
    assert "github.event_name != 'pull_request'" not in content
