import pytest

from makma.telemetry import TelemetryCollector


def test_telemetry_summarizes_latency_failures_and_cost() -> None:
    telemetry = TelemetryCollector(max_events=10)
    telemetry.record("model", latency_ms=10, success=True, cost_usd=0.01)
    telemetry.record("model", latency_ms=20, success=False, cost_usd=0.02)
    telemetry.record("model", latency_ms=30, success=True, cost_usd=0.03)

    summary = telemetry.summarize("model")

    assert summary.count == 3
    assert summary.successes == 2
    assert summary.failures == 1
    assert summary.failure_rate == pytest.approx(1 / 3)
    assert summary.p50_latency_ms == 20
    assert summary.p95_latency_ms == 30
    assert summary.total_cost_usd == pytest.approx(0.06)


def test_telemetry_is_bounded_and_keeps_normalized_attributes() -> None:
    telemetry = TelemetryCollector(max_events=2)
    telemetry.record("tool", latency_ms=1, success=True, attributes={"tool": "search"})
    telemetry.record("tool", latency_ms=2, success=True)
    telemetry.record("tool", latency_ms=3, success=False)

    events = telemetry.events()

    assert len(events) == 2
    assert events[0].latency_ms == 2
    assert events[1].success is False


@pytest.mark.parametrize(
    ("kwargs", "error"),
    [
        ({"latency_ms": -1, "success": True}, ValueError),
        ({"latency_ms": 1, "success": "yes"}, TypeError),
        ({"latency_ms": 1, "success": True, "cost_usd": -1}, ValueError),
    ],
)
def test_telemetry_rejects_invalid_measurements(
    kwargs: dict[str, object],
    error: type[Exception],
) -> None:
    telemetry = TelemetryCollector()

    with pytest.raises(error):
        telemetry.record("model", **kwargs)
