from collections import deque
from collections.abc import Mapping, Sequence
from typing import Protocol
from dataclasses import dataclass
from math import ceil, isfinite


@dataclass(frozen=True, slots=True)
class TelemetryEvent:
    operation: str
    latency_ms: float
    success: bool
    cost_usd: float = 0.0
    attributes: tuple[tuple[str, str], ...] = ()


class TelemetrySink(Protocol):
    def emit(self, event: "TelemetryEvent") -> None: ...


@dataclass(frozen=True, slots=True)
class OperationSummary:
    operation: str
    count: int
    successes: int
    failures: int
    failure_rate: float
    p50_latency_ms: float
    p95_latency_ms: float
    total_cost_usd: float


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, ceil(percentile * len(ordered)))
    return ordered[rank - 1]


class TelemetryCollector:
    """Bounded in-memory telemetry for local agent and tool execution."""

    def __init__(
        self,
        *,
        max_events: int = 1_000,
        sinks: Sequence[TelemetrySink] = (),
    ) -> None:
        if isinstance(max_events, bool) or not isinstance(max_events, int) or max_events <= 0:
            raise ValueError("max_events must be a positive integer")
        self._events: deque[TelemetryEvent] = deque(maxlen=max_events)
        self._sinks = tuple(sinks)
        self._sink_failures = 0

    def record(
        self,
        operation: str,
        *,
        latency_ms: float,
        success: bool,
        cost_usd: float = 0.0,
        attributes: Mapping[str, object] | None = None,
    ) -> TelemetryEvent:
        if not isinstance(operation, str) or not operation.strip():
            raise ValueError("operation must be a non-empty string")
        if isinstance(success, bool) is False:
            raise TypeError("success must be a boolean")
        if isinstance(latency_ms, bool) or not isinstance(latency_ms, (int, float)):
            raise TypeError("latency_ms must be a number")
        if isinstance(cost_usd, bool) or not isinstance(cost_usd, (int, float)):
            raise TypeError("cost_usd must be a number")
        if not isfinite(float(latency_ms)) or latency_ms < 0:
            raise ValueError("latency_ms must be finite and non-negative")
        if not isfinite(float(cost_usd)) or cost_usd < 0:
            raise ValueError("cost_usd must be finite and non-negative")

        normalized_attributes = tuple(
            sorted((str(key), str(value)) for key, value in (attributes or {}).items())
        )
        event = TelemetryEvent(
            operation=operation.strip(),
            latency_ms=float(latency_ms),
            success=success,
            cost_usd=float(cost_usd),
            attributes=normalized_attributes,
        )
        self._events.append(event)
        for sink in self._sinks:
            try:
                sink.emit(event)
            except Exception:
                # Instrumentation must never make the agent runtime unavailable.
                self._sink_failures += 1
        return event

    def events(self) -> tuple[TelemetryEvent, ...]:
        return tuple(self._events)

    @property
    def sink_failures(self) -> int:
        return self._sink_failures

    def summarize(self, operation: str | None = None) -> OperationSummary:
        selected = [
            event
            for event in self._events
            if operation is None or event.operation == operation
        ]
        name = operation or "*"
        if not selected:
            return OperationSummary(name, 0, 0, 0, 0.0, 0.0, 0.0, 0.0)

        successes = sum(event.success for event in selected)
        failures = len(selected) - successes
        latencies = [event.latency_ms for event in selected]
        return OperationSummary(
            operation=name,
            count=len(selected),
            successes=successes,
            failures=failures,
            failure_rate=failures / len(selected),
            p50_latency_ms=_percentile(latencies, 0.50),
            p95_latency_ms=_percentile(latencies, 0.95),
            total_cost_usd=sum(event.cost_usd for event in selected),
        )
