from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


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


class ChatResponse(BaseModel):
    response: str
    session_id: str
    run_id: str
    provider: str
    latency_ms: float
    plan: list[PlanStep] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)


class RunRecord(BaseModel):
    run_id: str
    session_id: str
    user_message: str
    response: str
    provider: str
    latency_ms: float
    created_at: str
