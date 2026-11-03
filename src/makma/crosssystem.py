"""Cross-system workflows built on the makma.v1 specialists.

Each workflow is an ordinary :class:`~makma.workflows.WorkflowSpec`. Where one
specialist's output does not fit the next specialist's input, the gap is closed by a
small, deterministic *translation tool* registered here (never by hard-coded data):

* ``evidence_entities``   clinical-document-intelligence export -> knowledge-twin entities
* ``candidate_graph``     knowledge-twin extraction -> ``knowledge-twin.graph.v1`` graph
* ``relevance_judgment``  agentic-rag-engine retrieval rows + knowledge-twin path evidence
                          -> llm-eval-observability ``score_retrieval`` query
* ``artifact_reference``  mlops-production-pipeline artifact path -> path relative to the
                          mlops-control-plane artifact root (+ file URI)
* ``record_lifecycle_transition``  the governed-ML lifecycle transition. The
  mlops-control-plane makma.v1 contract exposes no approve/promote operation, so this
  step is *simulated*: it records the human-approved decision in an orchestrator-side
  registry and never deploys or changes the control plane.

Workflows:

* :func:`research_evidence_workflow` (A)
* :func:`governed_ml_workflow` (B)
* :func:`media_workflow` (C)
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from makma.tools import ToolDefinition, ToolRegistry, current_idempotency_key
from makma.workflows import WorkflowSpec, WorkflowStep

TRANSLATION_TOOLS = (
    "evidence_entities",
    "candidate_graph",
    "relevance_judgment",
    "artifact_reference",
    "record_lifecycle_transition",
)


def _dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


# --------------------------------------------------------------------------- translations


async def evidence_entities(arguments: dict[str, Any], session_id: str) -> str:
    """Turn evidence-backed clinical fields into knowledge-twin entities.

    A requested field without a value *and* an evidence span is an error: no entity
    is ever invented.
    """
    del session_id
    export = arguments["export"]
    by_field = {item.get("field"): item for item in export.get("fields", [])}
    entities: list[dict[str, str]] = []
    evidence: list[dict[str, Any]] = []
    for name in arguments["fields"]:
        item = by_field.get(name)
        if item is None or item.get("value") in (None, "") or not item.get("evidence"):
            raise ValueError(f"Field {name!r} has no evidence-backed value.")
        span = item["evidence"]
        entities.append({"id": name, "kind": name, "name": str(span["text"])})
        evidence.append(
            {"field": name, "start": span["start"], "end": span["end"], "text": span["text"]}
        )
    return _dumps(
        {
            "entities": entities,
            "evidence": evidence,
            "document_sha256": export.get("document", {}).get("sha256"),
        }
    )


async def candidate_graph(arguments: dict[str, Any], session_id: str) -> str:
    del session_id
    edges = arguments["candidate_edges"]
    if not edges:
        raise ValueError("No candidate edges were extracted; refusing to build an empty graph.")
    return _dumps(
        {
            "format": "knowledge-twin.graph.v1",
            "entities": arguments["entities"],
            "edges": edges,
            "retracted_edges": [],
        }
    )


async def relevance_judgment(arguments: dict[str, Any], session_id: str) -> str:
    """A retrieved chunk is relevant when its document is the source of path evidence."""
    del session_id
    evidence_documents = sorted(
        {
            hop["provenance"]["document_id"]
            for hop in arguments["evidence_hops"]
            if isinstance(hop.get("provenance"), dict)
        }
    )
    if not evidence_documents:
        raise ValueError("Path evidence carries no document provenance.")
    rows = arguments["results"]
    retrieved = [row["chunk_id"] for row in rows]
    relevant = [row["chunk_id"] for row in rows if row["document_id"] in evidence_documents]
    if not relevant:
        # score_retrieval requires at least one relevant id; judge by document instead
        # of silently passing an empty list.
        relevant = [f"document:{document_id}" for document_id in evidence_documents]
    return _dumps(
        {
            "query_id": arguments["query_id"],
            "retrieved_ids": retrieved,
            "relevant_ids": relevant,
            "evidence_documents": evidence_documents,
        }
    )


def artifact_reference_tool(artifact_root: Path) -> Any:
    root = artifact_root.resolve(strict=True)

    async def artifact_reference(arguments: dict[str, Any], session_id: str) -> str:
        del session_id
        path = Path(arguments["artifact_path"]).resolve(strict=True)
        try:
            relative = path.relative_to(root)
        except ValueError as error:
            raise ValueError("Artifact is outside the shared artifact root.") from error
        return _dumps({"relative_path": relative.as_posix(), "uri": path.as_uri()})

    return artifact_reference


@dataclass
class SimulatedLifecycleRegistry:
    """Orchestrator-side record of approved lifecycle transitions. Never deploys."""

    transitions: list[dict[str, Any]] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record(self, entry: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            key = entry["idempotency_key"]
            for existing in self.transitions:
                if existing["idempotency_key"] == key:
                    return existing  # de-duplicate a recovered/re-approved step
            self.transitions.append(entry)
            return entry


def lifecycle_transition_tool(registry: SimulatedLifecycleRegistry) -> Any:
    async def record_lifecycle_transition(arguments: dict[str, Any], session_id: str) -> str:
        del session_id
        decision = arguments["decision"]
        if decision not in {"allow", "requires_approval"}:
            raise ValueError(f"Control-plane decision {decision!r} does not permit a transition.")
        entry = registry.record(
            {
                "model_key": arguments["model_key"],
                "evidence_sha256": arguments["evidence_sha256"],
                "control_plane_decision": decision,
                "target_stage": arguments["target_stage"],
                "simulated": True,
                "deployed": False,
                "idempotency_key": current_idempotency_key(),
                "recorded_at": datetime.now(UTC).isoformat(),
            }
        )
        return _dumps(entry)

    return record_lifecycle_transition


def register_translation_tools(
    registry: ToolRegistry,
    *,
    artifact_root: Path | None = None,
    lifecycle: SimulatedLifecycleRegistry | None = None,
) -> None:
    registry.register(ToolDefinition(
        "evidence_entities",
        "Map evidence-backed clinical fields to knowledge-twin entities.",
        evidence_entities,
        input_schema={
            "type": "object", "additionalProperties": False, "required": ["export", "fields"],
            "properties": {
                "export": {"type": "object", "required": ["fields"]},
                "fields": {"type": "array", "minItems": 1,
                           "items": {"type": "string", "minLength": 1}},
            },
        },
    ))
    registry.register(ToolDefinition(
        "candidate_graph",
        "Wrap extracted candidate edges and their entities as a knowledge-twin graph.",
        candidate_graph,
        input_schema={
            "type": "object", "additionalProperties": False,
            "required": ["entities", "candidate_edges"],
            "properties": {"entities": {"type": "array"}, "candidate_edges": {"type": "array"}},
        },
    ))
    registry.register(ToolDefinition(
        "relevance_judgment",
        "Judge retrieved chunks relevant when their document backs the evidence path.",
        relevance_judgment,
        input_schema={
            "type": "object", "additionalProperties": False,
            "required": ["query_id", "results", "evidence_hops"],
            "properties": {
                "query_id": {"type": "string", "minLength": 1},
                "results": {"type": "array", "items": {
                    "type": "object", "required": ["chunk_id", "document_id"]}},
                "evidence_hops": {"type": "array", "minItems": 1},
            },
        },
    ))
    if artifact_root is not None:
        registry.register(ToolDefinition(
            "artifact_reference",
            "Express a pipeline artifact path relative to the shared artifact root.",
            artifact_reference_tool(artifact_root),
            input_schema={
                "type": "object", "additionalProperties": False, "required": ["artifact_path"],
                "properties": {"artifact_path": {"type": "string", "minLength": 1}},
            },
        ))
    if lifecycle is not None:
        registry.register(ToolDefinition(
            "record_lifecycle_transition",
            "SIMULATED lifecycle transition (orchestrator record only; never deploys).",
            lifecycle_transition_tool(lifecycle),
            side_effects=True,
            risk_level="high",
            requires_approval=True,
            idempotent=True,
            input_schema={
                "type": "object", "additionalProperties": False,
                "required": ["model_key", "evidence_sha256", "decision", "target_stage"],
                "properties": {
                    "model_key": {"type": "string", "minLength": 1},
                    "evidence_sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
                    "decision": {"type": "string"},
                    "target_stage": {"enum": ["candidate", "production"]},
                },
            },
        ))


# --------------------------------------------------------------------------- workflows

RESEARCH = "clinical-document-intelligence"
TWIN = "knowledge-twin"
RAG = "agentic-rag-engine"
EVAL = "llm-eval-observability"
COPILOT = "secure-data-copilot"
PIPELINE = "mlops-production-pipeline"
CONTROL = "mlops-control-plane"
STUDIO = "multimodal-ai-studio"


def research_evidence_workflow() -> WorkflowSpec:
    """A: clinical extraction -> knowledge graph path -> RAG answer -> citation checks."""
    primary = "${inputs.documents.0.text}"
    return WorkflowSpec(
        name="research-evidence",
        input_schema={
            "type": "object", "additionalProperties": False,
            "required": ["documents", "question", "fields", "relation_patterns",
                         "path_source", "path_target"],
            "properties": {
                "documents": {"type": "array", "minItems": 1, "maxItems": 100, "items": {
                    "type": "object", "additionalProperties": False, "required": ["id", "text"],
                    "properties": {"id": {"type": "string", "minLength": 1},
                                   "text": {"type": "string", "minLength": 1}}}},
                "question": {"type": "string", "minLength": 1},
                "fields": {"type": "array", "minItems": 2, "items": {"type": "string"}},
                "relation_patterns": {"type": "object", "minProperties": 1,
                                      "additionalProperties": {"type": "string"}},
                "path_source": {"type": "string", "minLength": 1},
                "path_target": {"type": "string", "minLength": 1},
            },
        },
        steps=(
            WorkflowStep("clinical_extract", specialist=RESEARCH, operation="extract",
                         arguments={"text": primary}),
            WorkflowStep("entities", "evidence_entities",
                         {"export": "${steps.clinical_extract.data}",
                          "fields": "${inputs.fields}"},
                         depends_on=("clinical_extract",)),
            WorkflowStep("twin_extract", specialist=TWIN, operation="extract",
                         arguments={"text": primary, "document_id": "${inputs.documents.0.id}",
                                    "entities": "${steps.entities.data.entities}",
                                    "relation_patterns": "${inputs.relation_patterns}"},
                         depends_on=("entities",)),
            WorkflowStep("graph", "candidate_graph",
                         {"entities": "${steps.entities.data.entities}",
                          "candidate_edges": "${steps.twin_extract.data.candidate_edges}"},
                         depends_on=("twin_extract",)),
            WorkflowStep("twin_import", specialist=TWIN, operation="import_graph",
                         arguments={"incoming": "${steps.graph.data}",
                                    "import_id": "research-evidence"},
                         depends_on=("graph",)),
            WorkflowStep("twin_path", specialist=TWIN, operation="query_path",
                         arguments={"graph": "${steps.twin_import.data.graph}",
                                    "source": "${inputs.path_source}",
                                    "target": "${inputs.path_target}"},
                         depends_on=("twin_import",)),
            # Side-effecting: the run pauses here for an AI OS approval.
            WorkflowStep("rag_ingest", specialist=RAG, operation="ingest",
                         arguments={"documents": "${inputs.documents}"},
                         depends_on=("twin_path",)),
            WorkflowStep("rag_answer", specialist=RAG, operation="answer",
                         arguments={"query": "${inputs.question}", "top_k": 3},
                         depends_on=("rag_ingest",)),
            WorkflowStep("rag_retrieve", specialist=RAG, operation="retrieve",
                         arguments={"query": "${inputs.question}", "top_k": 3},
                         depends_on=("rag_ingest",)),
            WorkflowStep("eval_citations", specialist=EVAL, operation="validate_citations",
                         arguments={"cited_ids": "${steps.rag_answer.data.citations}",
                                    "evidence_ids": "${steps.rag_answer.data.retrieved_chunk_ids}",
                                    "require_citation": True},
                         depends_on=("rag_answer",)),
            WorkflowStep("judgment", "relevance_judgment",
                         {"query_id": "research-question",
                          "results": "${steps.rag_retrieve.data.results}",
                          "evidence_hops": "${steps.twin_path.data.hops}"},
                         depends_on=("rag_retrieve", "twin_path")),
            WorkflowStep("eval_retrieval", specialist=EVAL, operation="score_retrieval",
                         arguments={"k": 3, "queries": [{
                             "query_id": "${steps.judgment.data.query_id}",
                             "retrieved_ids": "${steps.judgment.data.retrieved_ids}",
                             "relevant_ids": "${steps.judgment.data.relevant_ids}"}]},
                         depends_on=("judgment",)),
        ),
    )


def governed_ml_workflow() -> WorkflowSpec:
    """B: governed SQL -> dataset validation -> training -> registration -> promotion gate."""
    data = "${steps.copilot_query.data.rows}"
    experiment = {"records": data, "schema": "${inputs.schema}", "config": "${inputs.config}",
                  "code_version": "${inputs.code_version}"}
    return WorkflowSpec(
        name="governed-ml",
        input_schema={
            "type": "object", "additionalProperties": False,
            "required": ["sql", "schema", "config", "code_version", "output_dir",
                         "model_name", "model_version"],
            "properties": {
                "sql": {"type": "string", "minLength": 1},
                "schema": {"type": "object"},
                "config": {"type": "object"},
                "code_version": {"type": "string"},
                "output_dir": {"type": "string", "minLength": 1},
                "model_name": {"type": "string"},
                "model_version": {"type": "string"},
            },
        },
        steps=(
            WorkflowStep("copilot_query", specialist=COPILOT, operation="query",
                         arguments={"sql": "${inputs.sql}", "max_rows": 1000}),
            WorkflowStep("validate_dataset", specialist=PIPELINE, operation="validate_dataset",
                         arguments={"records": data, "schema": "${inputs.schema}"},
                         depends_on=("copilot_query",)),
            WorkflowStep("train", specialist=PIPELINE, operation="train",
                         arguments={**experiment, "output_dir": "${inputs.output_dir}"},
                         depends_on=("validate_dataset",)),
            WorkflowStep("evaluate_candidate", specialist=PIPELINE,
                         operation="evaluate_candidate", arguments=experiment,
                         depends_on=("train",)),
            WorkflowStep("artifact", "artifact_reference",
                         {"artifact_path": "${steps.train.data.artifact_path}"},
                         depends_on=("train",)),
            WorkflowStep("register", specialist=CONTROL, operation="register_candidate",
                         arguments={
                             "pipeline_export": "${steps.evaluate_candidate.data.candidate}",
                             "model_name": "${inputs.model_name}",
                             "model_version": "${inputs.model_version}",
                             "artifact_uri": "${steps.artifact.data.uri}",
                             "submitted_by": "makma-ai-os"},
                         depends_on=("evaluate_candidate", "artifact")),
            WorkflowStep("verify_artifact", specialist=CONTROL, operation="verify_artifact",
                         arguments={"model_name": "${inputs.model_name}",
                                    "model_version": "${inputs.model_version}",
                                    "path": "${steps.artifact.data.relative_path}"},
                         depends_on=("register",)),
            WorkflowStep("promotion", specialist=CONTROL, operation="evaluate_promotion",
                         arguments={"model_name": "${inputs.model_name}",
                                    "model_version": "${inputs.model_version}"},
                         depends_on=("verify_artifact",), accept_pending_approval=True),
            # Always approval-gated (high risk, side effects): the human decision.
            WorkflowStep("transition", "record_lifecycle_transition",
                         {"model_key": "${steps.promotion.data.model_key}",
                          "evidence_sha256": "${steps.promotion.data.evidence_sha256}",
                          "decision": "${steps.promotion.data.decision}",
                          "target_stage": "production"},
                         depends_on=("promotion",)),
        ),
    )


def media_workflow() -> WorkflowSpec:
    """C: plan an edit -> approval-gated render -> independent artifact verification."""
    return WorkflowSpec(
        name="media-edit",
        input_schema={
            "type": "object", "additionalProperties": False,
            "required": ["prompt", "source_path", "destination_path"],
            "properties": {
                "prompt": {"type": "string", "minLength": 1},
                "source_path": {"type": "string", "minLength": 1},
                "destination_path": {"type": "string", "minLength": 1},
            },
        },
        steps=(
            WorkflowStep("plan", specialist=STUDIO, operation="plan",
                         arguments={"prompt": "${inputs.prompt}"}),
            WorkflowStep("execute", specialist=STUDIO, operation="execute",
                         arguments={"nodes": "${steps.plan.data.nodes}",
                                    "source_path": "${inputs.source_path}",
                                    "destination_path": "${inputs.destination_path}",
                                    "timeout_seconds": 120},
                         depends_on=("plan",), approval_argument="approved"),
            WorkflowStep("verify", specialist=STUDIO, operation="verify_artifact",
                         arguments={"path": "${steps.execute.data.output_path}",
                                    "expected_sha256": "${steps.execute.data.artifact.sha256}",
                                    "expected_width":
                                        "${steps.execute.data.projected_output.width}",
                                    "expected_height":
                                        "${steps.execute.data.projected_output.height}",
                                    "require_video": True},
                         depends_on=("execute",)),
        ),
    )


def specialist_actions(spec: WorkflowSpec) -> frozenset[str]:
    return frozenset(step.action for step in spec.steps)


def environment_flag(name: str) -> bool:
    return os.environ.get(name, "").strip() == "1"
