"""Workflows A/B/C executed end to end against the real specialist packages.

Nothing here is a hard-coded specialist output: every assertion recomputes a hash,
id or citation from the inputs or from another system's output and checks that the
value flowed through the orchestrator unchanged.
"""

from __future__ import annotations

import functools
import hashlib
import importlib
import json
import os
import random
import shutil
import sqlite3
import subprocess
from pathlib import Path

import pytest

from makma.contracts import validate_envelope
from makma.crosssystem import (
    TRANSLATION_TOOLS,
    SimulatedLifecycleRegistry,
    governed_ml_workflow,
    media_workflow,
    register_translation_tools,
    research_evidence_workflow,
    specialist_actions,
)
from makma.specialists import InProcessSpecialistAdapter, SpecialistRegistry
from makma.tools import PermissionPolicy, ToolRegistry
from makma.workflows import SQLiteWorkflowStore, WorkflowEngine

pytestmark = pytest.mark.integration

PACKAGES = {
    "agentic-rag-engine": "rag_engine",
    "multimodal-ai-studio": "multimodal_studio",
    "knowledge-twin": "knowledge_twin",
    "clinical-document-intelligence": "clinical_intel",
    "secure-data-copilot": "data_copilot",
    "llm-eval-observability": "llm_eval",
    "mlops-control-plane": "mlops_cp",
    "mlops-production-pipeline": "mlops_pipeline",
}


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def contracts(system: str):
    # ImportError here fails the job: the package must be installed in integration CI.
    return importlib.import_module(PACKAGES[system] + ".contracts")


def adapter(system: str, **inject) -> InProcessSpecialistAdapter:
    module = contracts(system)
    run = functools.partial(module.run_operation, **inject) if inject else module.run_operation
    return InProcessSpecialistAdapter(system, run, module.capabilities)


def build_engine(tmp_path: Path, spec, adapters, *, artifact_root=None, lifecycle=None):
    tools = ToolRegistry()
    register_translation_tools(tools, artifact_root=artifact_root, lifecycle=lifecycle)
    allowed = specialist_actions(spec) | frozenset(tools.names)
    return WorkflowEngine(
        tools,
        policy=PermissionPolicy(allowed_tools=allowed),
        store=SQLiteWorkflowStore(str(tmp_path / f"{spec.name}.sqlite")),
        specialists=SpecialistRegistry(adapters),
    )


async def drive(engine: WorkflowEngine, checkpoint, approver: str):
    """Approve each step the run pauses on, in order, and return them."""
    approved: list[str] = []
    while checkpoint.status == "paused":
        step = checkpoint.pending_step
        approved.append(step)
        checkpoint = await engine.resume(checkpoint.run_id, approved_steps={step},
                                         approver=approver)
    return checkpoint, approved


def assert_specialist_envelopes(checkpoint) -> None:
    for step_id, result in checkpoint.results.items():
        if result["kind"] != "specialist":
            continue
        envelope = result["envelope"]
        assert validate_envelope(envelope, expected_run_id=checkpoint.run_id,
                                 expected_correlation_id=checkpoint.correlation_id) == [], step_id
        # Every specialist used here is deterministic offline code in this setup.
        assert envelope["execution_mode"] == "deterministic_offline", step_id


def test_every_pinned_specialist_is_installed_and_exposes_makma_v1():
    for system in PACKAGES:
        caps = contracts(system).capabilities()
        assert caps["contract_version"] == "makma.v1" and caps["system"] == system


# =========================================================================== A


PRIMARY = (
    "Study ID: SYN-500\n"
    "Phase: II\n"
    "Participants: 64\n"
    "Intervention: Example compound\n"
    "Primary Endpoint: Synthetic score\n"
    "SYN-500 evaluates Example compound. Example compound is measured by Synthetic score.\n"
)
SECONDARY = (
    "Study ID: SYN-501\n"
    "Phase: III\n"
    "Participants: 120\n"
    "Intervention: Placebo tablet\n"
    "Primary Endpoint: Synthetic recovery time\n"
)
RESEARCH_INPUTS = {
    "documents": [{"id": "trial-syn-500", "text": PRIMARY},
                  {"id": "trial-syn-501", "text": SECONDARY}],
    "question": "Which intervention does SYN-500 evaluate and how is it measured?",
    "fields": ["study_id", "intervention", "primary_endpoint"],
    "relation_patterns": {"evaluates": "EVALUATES", "is measured by": "MEASURED_BY"},
    "path_source": "study_id",
    "path_target": "primary_endpoint",
}


@pytest.mark.asyncio
async def test_workflow_a_research_and_evidence(tmp_path):
    from rag_engine.settings import Settings
    from rag_engine.settings import build_engine as build_rag

    rag = build_rag(Settings())
    spec = research_evidence_workflow()
    engine = build_engine(tmp_path, spec, [
        adapter("clinical-document-intelligence"),
        adapter("knowledge-twin"),
        adapter("agentic-rag-engine", engine=rag),
        adapter("llm-eval-observability"),
    ])

    paused = await engine.start(spec, session_id="research", inputs=RESEARCH_INPUTS,
                                correlation_id="research-corr")
    # Ingest is side-effecting: nothing was indexed before the approval.
    assert paused.status == "paused" and paused.pending_step == "rag_ingest"
    assert len(rag.documents) == 0
    done, approvals = await drive(engine, paused, approver="research-lead")
    assert done.status == "succeeded", (done.error_code, done.error)
    assert approvals == ["rag_ingest"]
    assert_specialist_envelopes(done)
    data = {step: result["envelope"]["data"] for step, result in done.results.items()
            if result["kind"] == "specialist"}
    tools = {step: json.loads(done.outputs[step]) for step in ("entities", "graph", "judgment")}

    # clinical extraction: document hash and evidence spans are those of the input text
    clinical = data["clinical_extract"]
    assert clinical["document"]["sha256"] == sha256_text(PRIMARY)
    for item in tools["entities"]["evidence"]:
        assert PRIMARY[item["start"]:item["end"]] == item["text"]
    names = {entity["id"]: entity["name"] for entity in tools["entities"]["entities"]}
    assert names == {"study_id": "SYN-500", "intervention": "Example compound",
                     "primary_endpoint": "Synthetic score"}

    # knowledge twin: edges come from the same bytes, quotes are exact substrings
    twin = data["twin_extract"]
    assert twin["source_sha256"] == sha256_text(PRIMARY)
    assert tools["graph"]["edges"] == twin["candidate_edges"]
    for edge in twin["candidate_edges"]:
        span = edge["provenance"]
        assert span["source_sha256"] == sha256_text(PRIMARY)
        assert PRIMARY[span["start"]:span["end"]] == span["quote"]
    assert data["twin_import"]["report"]["applied"] is True
    path = data["twin_path"]
    assert path["found"] and [hop["relation"] for hop in path["hops"]] == [
        "EVALUATES", "MEASURED_BY"]
    assert {hop["provenance"]["document_id"] for hop in path["hops"]} == {"trial-syn-500"}

    # RAG: what was ingested is what the answer cites
    ingest = data["rag_ingest"]
    assert ingest["document_ids"] == ["trial-syn-500", "trial-syn-501"]
    answer = data["rag_answer"]
    assert answer["trace"]["index_fingerprint"] == ingest["index_fingerprint"]
    assert answer["citations"] and set(answer["citations"]) <= set(answer["retrieved_chunk_ids"])
    ingest_provenance = done.results["rag_ingest"]["envelope"]["provenance"]
    assert {(p["id"], p["sha256"]) for p in ingest_provenance} == {
        ("trial-syn-500", sha256_text(PRIMARY)), ("trial-syn-501", sha256_text(SECONDARY))}

    # eval: citation check over the exact RAG ids
    citations = data["eval_citations"]
    assert citations["valid"] is True
    assert citations["cited_count"] == len(answer["citations"])
    assert citations["unknown_ids"] == []

    # eval: retrieval judged against knowledge-twin evidence (recomputed independently)
    retrieved = [row["chunk_id"] for row in data["rag_retrieve"]["results"]]
    relevant = [row["chunk_id"] for row in data["rag_retrieve"]["results"]
                if row["document_id"] == "trial-syn-500"]
    assert tools["judgment"]["retrieved_ids"] == retrieved
    assert tools["judgment"]["relevant_ids"] == relevant and relevant
    scored = data["eval_retrieval"]["queries"][0]
    expected_recall = len(set(retrieved[:3]) & set(relevant)) / len(relevant)
    assert scored["recall_at_k"] == pytest.approx(expected_recall)
    assert scored["hits_at_k"] == len(set(retrieved[:3]) & set(relevant))

    # AI OS trace: every step has a span, specialist spans link the specialist trace
    trace = engine.trace(done.run_id)
    assert {event["correlation_id"] for event in trace} == {"research-corr"}
    for step in spec.steps:
        succeeded = [e for e in trace if e["step_id"] == step.id and e["event"] == "step_succeeded"]
        assert len(succeeded) == 1, step.id
        if step.kind == "specialist":
            assert len(succeeded[0]["detail"]["specialist_trace_id"]) == 32
    approved = [e for e in trace if e["event"] == "step_approved"]
    assert [(e["step_id"], e["detail"]["approver"]) for e in approved] == [
        ("rag_ingest", "research-lead")]


# =========================================================================== B

SQL = "SELECT ad_spend, visits, revenue FROM sales ORDER BY id"
SCHEMA = {"features": ["ad_spend", "visits"], "label": "revenue"}


def business_db(path: Path, *, noise: float) -> None:
    rng = random.Random(7)
    with sqlite3.connect(path) as connection:
        connection.execute(
            "CREATE TABLE sales (id INTEGER PRIMARY KEY, region TEXT, ad_spend REAL, "
            "visits REAL, revenue REAL, customer_email TEXT)"
        )
        for index in range(60):
            ad_spend = rng.uniform(1, 10)
            visits = rng.uniform(10, 100)
            revenue = 3 * ad_spend + 0.5 * visits + 2 + rng.uniform(-noise, noise)
            connection.execute(
                "INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?)",
                (index, "north" if index % 2 else "south", ad_spend, visits, revenue,
                 f"customer{index}@example.test"),
            )
    connection.close()


def governed_setup(tmp_path: Path, monkeypatch, *, noise: float):
    from mlops_cp.governed import GovernanceService

    workspace = tmp_path / "workspace"
    workspace.mkdir()
    business_db(tmp_path / "business.db", noise=noise)
    monkeypatch.setenv("COPILOT_DATABASE_PATH", str(tmp_path / "business.db"))
    monkeypatch.setenv("COPILOT_ALLOWED_TABLES", "sales")
    monkeypatch.setenv("COPILOT_DENIED_COLUMNS", "customer_email")
    monkeypatch.setenv("MLOPS_PIPELINE_WORKSPACE", str(workspace))
    service = GovernanceService(database_path=str(tmp_path / "governance.db"),
                                artifact_root=str(workspace))
    lifecycle = SimulatedLifecycleRegistry()
    spec = governed_ml_workflow()
    engine = build_engine(tmp_path, spec, [
        adapter("secure-data-copilot"),
        adapter("mlops-production-pipeline"),
        adapter("mlops-control-plane", service=service),
    ], artifact_root=workspace, lifecycle=lifecycle)
    inputs = {"sql": SQL, "schema": SCHEMA,
              "config": {"model_name": "revenue", "max_test_mae": 1.0, "max_feature_psi": 5.0},
              "code_version": "integration-test", "output_dir": "runs/revenue-1",
              "model_name": "revenue", "model_version": "1.0.0"}
    return spec, engine, inputs, service, lifecycle, workspace


@pytest.mark.asyncio
async def test_workflow_b_governed_ml_reaches_human_gate_and_records_simulated_transition(
    tmp_path, monkeypatch,
):
    spec, engine, inputs, service, lifecycle, workspace = governed_setup(
        tmp_path, monkeypatch, noise=0.2)
    checkpoint = await engine.start(spec, session_id="ml", inputs=inputs)
    approvals: list[str] = []
    while checkpoint.status == "paused":
        step = checkpoint.pending_step
        if step == "transition":
            # The human gate: before approval nothing was recorded anywhere.
            assert lifecycle.transitions == []
            assert checkpoint.results["promotion"]["envelope"]["status"] == "pending_approval"
        approvals.append(step)
        approver = "release-manager" if step == "transition" else "ml-engineer"
        checkpoint = await engine.resume(checkpoint.run_id, approved_steps={step},
                                         approver=approver)
    done = checkpoint
    assert done.status == "succeeded", (done.error_code, done.error)
    assert approvals == ["train", "register", "verify_artifact", "transition"]
    assert_specialist_envelopes(done)
    data = {step: result["envelope"]["data"] for step, result in done.results.items()
            if result["kind"] == "specialist"}

    query = data["copilot_query"]
    assert query["columns"] == ["ad_spend", "visits", "revenue"]
    assert query["row_count"] == 60 and "customer_email" not in query["rows"][0]
    with sqlite3.connect(tmp_path / "business.db") as connection:
        source = connection.execute(SQL).fetchall()
    connection.close()
    assert [tuple(row[column] for column in query["columns"]) for row in query["rows"]] == source

    dataset_sha = data["validate_dataset"]["dataset_sha256"]
    candidate = data["evaluate_candidate"]["candidate"]
    assert data["validate_dataset"]["valid"] is True
    assert candidate["dataset_sha256"] == dataset_sha
    assert data["train"]["run_record"]["dataset"]["sha256"] == dataset_sha
    artifact_bytes = Path(data["train"]["artifact_path"]).read_bytes()
    artifact_sha = hashlib.sha256(artifact_bytes).hexdigest()
    assert candidate["artifact_sha256"] == artifact_sha
    assert candidate["gate"]["allowed"] is True

    register = data["register"]
    assert register["claimed_artifact_sha256"] == artifact_sha
    assert register["run_record_sha256"] == candidate["run_record_sha256"]
    assert register["pipeline_model_id"] == candidate["model_id"]
    artifact_ref = json.loads(done.outputs["artifact"])
    assert (workspace / artifact_ref["relative_path"]).read_bytes() == artifact_bytes
    assert json.dumps(data["verify_artifact"]).count(artifact_sha) >= 1

    promotion = done.results["promotion"]["envelope"]
    assert promotion["status"] == "pending_approval"
    assert promotion["policy"]["decision"] == "requires_approval"
    assert promotion["data"]["checks"]["artifact_verified"] is True
    assert promotion["data"]["evidence_sha256"] == register["evidence_sha256"]

    transition = json.loads(done.outputs["transition"])
    assert transition["simulated"] is True and transition["deployed"] is False
    assert transition["model_key"] == register["model_key"] == "revenue:1.0.0"
    assert transition["evidence_sha256"] == register["evidence_sha256"]
    assert lifecycle.transitions == [transition]
    # The control plane itself was not changed by the simulated transition.
    after = contracts("mlops-control-plane").run_operation(
        "evaluate_promotion", {"model_name": "revenue", "model_version": "1.0.0"},
        service=service)
    assert after["status"] == "pending_approval"


@pytest.mark.asyncio
async def test_workflow_b_failed_pipeline_gate_ends_blocked(tmp_path, monkeypatch):
    spec, engine, inputs, service, lifecycle, _ = governed_setup(
        tmp_path, monkeypatch, noise=50.0)
    done, approvals = await drive(engine, await engine.start(spec, session_id="ml",
                                                             inputs=inputs), "ml-engineer")
    assert done.status == "blocked"
    assert done.pending_step == "promotion" and done.error_code == "PROMOTION_DENIED"
    assert approvals == ["train", "register", "verify_artifact"]
    candidate = done.results["evaluate_candidate"]["envelope"]["data"]["candidate"]
    assert candidate["gate"]["allowed"] is False
    blocked = [e for e in engine.trace(done.run_id) if e["event"] == "step_blocked"][0]
    reasons = blocked["detail"]["specialist_policy_reasons"]
    assert any(reason.startswith("pipeline gate rejected candidate") for reason in reasons)
    assert done.steps["transition"]["state"] == "pending"
    assert "transition" not in done.results and lifecycle.transitions == []


@pytest.mark.asyncio
async def test_workflow_b_denied_column_is_blocked_by_data_policy(tmp_path, monkeypatch):
    spec, engine, inputs, *_ = governed_setup(tmp_path, monkeypatch, noise=0.2)
    inputs = {**inputs, "sql": "SELECT customer_email, revenue FROM sales"}
    done = await engine.start(spec, session_id="ml", inputs=inputs)
    assert done.status == "blocked" and done.error_code == "POLICY_DENIED"
    assert done.completed_steps == []


# =========================================================================== C

MEDIA_INPUTS = {"prompt": "trim 0s to 2s, resize to 48x32",
                "source_path": "input.mp4", "destination_path": "output.mp4"}


def media_engine(tmp_path: Path):
    spec = media_workflow()
    return spec, build_engine(tmp_path, spec, [adapter("multimodal-ai-studio")])


@pytest.mark.asyncio
async def test_workflow_c_without_ffmpeg_fails_honestly_after_approval(tmp_path, monkeypatch):
    workspace = tmp_path / "media"
    workspace.mkdir()
    (workspace / "input.mp4").write_bytes(b"not decoded: ffmpeg is unavailable")
    empty_bin = tmp_path / "empty-bin"
    empty_bin.mkdir()
    monkeypatch.setenv("PATH", str(empty_bin))  # hide any ffmpeg/ffprobe
    monkeypatch.setenv("MULTIMODAL_STUDIO_WORKSPACE", str(workspace))
    spec, engine = media_engine(tmp_path)

    paused = await engine.start(spec, session_id="media", inputs=MEDIA_INPUTS)
    assert paused.status == "paused" and paused.pending_step == "execute"
    plan = paused.results["plan"]["envelope"]["data"]
    assert [node["operation"] for node in plan["nodes"]] == ["resize", "trim"]
    done = await engine.resume(paused.run_id, approved_steps={"execute"}, approver="editor")
    assert done.status == "failed" and done.error_code == "FFMPEG_UNAVAILABLE"
    failed = [e for e in engine.trace(done.run_id) if e["event"] == "step_failed"][0]
    assert failed["detail"]["approval_argument_set"] is True
    assert "verify" not in done.results
    assert not (workspace / "output.mp4").exists()


@pytest.mark.media
@pytest.mark.asyncio
@pytest.mark.skipif(os.environ.get("MAKMA_MEDIA_E2E") != "1",
                    reason="full render path runs in the CI media job (MAKMA_MEDIA_E2E=1)")
async def test_workflow_c_renders_and_verifies_with_real_ffmpeg(tmp_path, monkeypatch):
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        pytest.fail("MAKMA_MEDIA_E2E=1 but ffmpeg/ffprobe are not on PATH")
    workspace = tmp_path / "media"
    workspace.mkdir()
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "testsrc=size=64x64:rate=12",
         "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000",
         "-t", "3", "-c:v", "mpeg4", "-c:a", "aac", "-shortest",
         str(workspace / "input.mp4")],
        check=True, capture_output=True, timeout=60,
    )
    monkeypatch.setenv("MULTIMODAL_STUDIO_WORKSPACE", str(workspace))
    spec, engine = media_engine(tmp_path)
    paused = await engine.start(spec, session_id="media", inputs=MEDIA_INPUTS)
    assert paused.pending_step == "execute" and not (workspace / "output.mp4").exists()
    done = await engine.resume(paused.run_id, approved_steps={"execute"}, approver="editor")
    assert done.status == "succeeded", (done.error_code, done.error)
    assert_specialist_envelopes(done)
    execute = done.results["execute"]["envelope"]["data"]
    verify = done.results["verify"]["envelope"]["data"]
    output_sha = hashlib.sha256((workspace / "output.mp4").read_bytes()).hexdigest()
    assert execute["artifact"]["sha256"] == verify["sha256"] == output_sha
    assert verify["probe_status"] == "verified" and verify["passed"] is True
    assert execute["projected_output"]["width"] == 48
    assert execute["projected_output"]["height"] == 32
    assert execute["fingerprint"] == done.results["plan"]["envelope"]["data"]["fingerprint"]


def test_translation_tool_names_are_stable():
    assert set(TRANSLATION_TOOLS) == {
        "evidence_entities", "candidate_graph", "relevance_judgment",
        "artifact_reference", "record_lifecycle_transition"}
