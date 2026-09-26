from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from typing import TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 5.0
    jitter_ratio: float = 0.2

    def __post_init__(self) -> None:
        if isinstance(self.max_attempts, bool) or not isinstance(self.max_attempts, int):
            raise TypeError("max_attempts must be an integer")
        if self.max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        if self.base_delay_seconds < 0 or self.max_delay_seconds < 0:
            raise ValueError("retry delays must be non-negative")
        if self.max_delay_seconds < self.base_delay_seconds:
            raise ValueError("max_delay_seconds must be >= base_delay_seconds")
        if not 0 <= self.jitter_ratio <= 1:
            raise ValueError("jitter_ratio must be between 0 and 1")

    def delay_for_attempt(self, attempt: int) -> float:
        if attempt < 1:
            raise ValueError("attempt must be at least 1")
        delay = min(
            self.max_delay_seconds,
            self.base_delay_seconds * (2 ** (attempt - 1)),
        )
        if delay == 0 or self.jitter_ratio == 0:
            return delay
        jitter = delay * self.jitter_ratio
        return max(0.0, delay + random.uniform(-jitter, jitter))


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(RuntimeError):
    pass


class CircuitBreaker:
    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        recovery_timeout_seconds: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if isinstance(failure_threshold, bool) or not isinstance(failure_threshold, int):
            raise TypeError("failure_threshold must be an integer")
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be positive")
        if recovery_timeout_seconds <= 0:
            raise ValueError("recovery_timeout_seconds must be positive")
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self._clock = clock
        self._failures = 0
        self._opened_at: float | None = None
        self._state = CircuitState.CLOSED

    @property
    def state(self) -> CircuitState:
        if self._state is CircuitState.OPEN and self._opened_at is not None:
            if self._clock() - self._opened_at >= self.recovery_timeout_seconds:
                self._state = CircuitState.HALF_OPEN
        return self._state

    def before_call(self) -> None:
        if self.state is CircuitState.OPEN:
            raise CircuitOpenError("circuit breaker is open")

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        if self.state is CircuitState.HALF_OPEN:
            self._failures = self.failure_threshold
        else:
            self._failures += 1
        if self._failures >= self.failure_threshold:
            self._state = CircuitState.OPEN
            self._opened_at = self._clock()


async def resilient_call(
    operation: Callable[[], Awaitable[T]],
    *,
    retry: RetryPolicy | None = None,
    circuit_breaker: CircuitBreaker | None = None,
    retry_if: Callable[[Exception], bool] | None = None,
) -> T:
    """Execute an idempotent async operation with bounded retries and a circuit breaker."""
    policy = retry or RetryPolicy()
    should_retry = retry_if or (lambda _: True)
    last_error: Exception | None = None

    for attempt in range(1, policy.max_attempts + 1):
        if circuit_breaker is not None:
            circuit_breaker.before_call()
        try:
            result = await operation()
        except Exception as error:
            last_error = error
            if circuit_breaker is not None:
                circuit_breaker.record_failure()
            if attempt >= policy.max_attempts or not should_retry(error):
                raise
            await asyncio.sleep(policy.delay_for_attempt(attempt))
        else:
            if circuit_breaker is not None:
                circuit_breaker.record_success()
            return result

    assert last_error is not None
    raise last_error
