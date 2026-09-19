# Advanced engineering: bounded telemetry

Mak'ma now includes a dependency-free telemetry primitive in `makma.telemetry`.

It records bounded operation events for model calls, tool calls, planner stages or other runtime
operations and produces deterministic summaries with success/failure counts, failure rate, p50/p95
latency and total measured cost.

The collector deliberately keeps a bounded deque rather than an unbounded process-global list. This
makes it suitable for local development, unit tests and adapters that later forward metrics to
OpenTelemetry, Prometheus or another observability backend.

## Example

```python
from makma.telemetry import TelemetryCollector

telemetry = TelemetryCollector(max_events=500)
telemetry.record(
    "provider.chat",
    latency_ms=42.5,
    success=True,
    cost_usd=0.002,
    attributes={"provider": "ollama"},
)
summary = telemetry.summarize("provider.chat")
```

Invalid negative/non-finite measurements and non-boolean success flags are rejected. Attribute
pairs are normalized and sorted so exported event data is deterministic.
