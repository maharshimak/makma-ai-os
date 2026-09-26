import pytest

from makma.resilience import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    RetryPolicy,
    resilient_call,
)


@pytest.mark.asyncio
async def test_resilient_call_retries_then_succeeds(monkeypatch):
    calls = 0

    async def operation():
        nonlocal calls
        calls += 1
        if calls < 3:
            raise RuntimeError("temporary")
        return "ok"

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("makma.resilience.asyncio.sleep", no_sleep)
    result = await resilient_call(
        operation,
        retry=RetryPolicy(max_attempts=3, base_delay_seconds=0, max_delay_seconds=0),
    )

    assert result == "ok"
    assert calls == 3


def test_circuit_breaker_opens_and_recovers():
    now = [0.0]
    breaker = CircuitBreaker(
        failure_threshold=2,
        recovery_timeout_seconds=10,
        clock=lambda: now[0],
    )

    breaker.record_failure()
    breaker.record_failure()
    assert breaker.state is CircuitState.OPEN
    with pytest.raises(CircuitOpenError):
        breaker.before_call()

    now[0] = 11.0
    assert breaker.state is CircuitState.HALF_OPEN
    breaker.record_success()
    assert breaker.state is CircuitState.CLOSED
