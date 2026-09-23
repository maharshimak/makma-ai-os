from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class MemoryMatch(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    score: float = Field(ge=0)
    created_at: str


class PlanStep(BaseModel):
    id: str
    kind: Literal["tool", "respond"]
    description: str
    tool_name: str | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    tool_name: str
    ok: bool
    output: str
    error: str | None = None
    latency_ms: float = Field(default=0.0, ge=0)
    trusted: bool = False
    provenance: str | None = None


class ExecutionMetrics(BaseModel):
    provider_latency_ms: float = Field(ge=0)
    tool_latency_ms: float = Field(ge=0)
    tool_calls: int = Field(ge=0)
    successful_tool_calls: int = Field(ge=0)
    failed_tool_calls: int = Field(ge=0)


class ChatResponse(BaseModel):
    response: str
    session_id: str
    run_id: str
    provider: str
    latency_ms: float
    plan: list[PlanStep] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    metrics: ExecutionMetrics


class RunRecord(BaseModel):
    run_id: str
    session_id: str
    user_message: str
    response: str
    provider: str
    latency_ms: float
    status: Literal["running", "succeeded", "failed"] = "succeeded"
    error: str | None = None
    created_at: str
    updated_at: str
