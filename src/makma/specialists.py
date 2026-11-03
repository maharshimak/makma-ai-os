"""Typed adapters through which the orchestrator calls specialist systems (makma.v1).

Every adapter returns a :class:`SpecialistOutcome`. Its ``envelope`` is only ever a
specialist envelope that passed :func:`makma.contracts.validate_envelope` *and* matched
the request (system, operation, run_id, correlation_id). Anything else becomes a
structured orchestrator-side error; malformed specialist payloads are never passed
through. A specialist that cannot be reached, is not configured or lacks credentials
surfaces as ``status == "unavailable"`` rather than as a fabricated result.

Transports:

* :class:`InProcessSpecialistAdapter` - calls ``run_operation(op, payload, run_id=...,
  correlation_id=...)`` of an importable module (or any callable with that signature).
* :class:`HttpSpecialistAdapter` - ``POST {base_url}/v1/ops/{operation}`` with a bearer
  token read from an environment variable at call time, a timeout, redirects refused
  and bounded retries only for retryable failures of retry-safe calls.
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
import ipaddress
import json
import os
from abc import ABC, abstractmethod
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal
from urllib.parse import urlsplit

import httpx
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from makma.contracts import (
    CONTRACT_VERSION,
    OPERATION_RE,
    SPECIALIST_SYSTEMS,
    validate_envelope,
)
from makma.resilience import RetryPolicy

OutcomeStatus = Literal["ok", "error", "blocked", "pending_approval", "unavailable"]
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
_RETRYABLE_HTTP = frozenset({429, 502, 503, 504})


@dataclass(frozen=True, slots=True)
class TraceContext:
    trace_id: str
    span_id: str

    def traceparent(self) -> str:
        return f"00-{self.trace_id}-{self.span_id}-01"


@dataclass(frozen=True, slots=True)
class OperationSpec:
    name: str
    side_effects: bool
    requires_approval: bool
    input_schema: dict[str, Any]
    timeout_s: float | None

    @property
    def approval_required(self) -> bool:
        return self.side_effects or self.requires_approval


@dataclass(frozen=True, slots=True)
class CapabilitySnapshot:
    system: str
    available: bool
    version: str | None = None
    operations: Mapping[str, OperationSpec] = field(default_factory=dict)
    error: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class SpecialistOutcome:
    system: str
    operation: str
    status: OutcomeStatus
    envelope: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    attempts: int = 1

    @property
    def ok(self) -> bool:
        return self.status == "ok"

    @property
    def retryable(self) -> bool:
        return bool(self.error and self.error.get("retryable"))

    @property
    def data(self) -> Any:
        return self.envelope["data"] if self.envelope is not None else None


def _error(
    code: str, message: str, *, retryable: bool = False, **details: Any
) -> dict[str, Any]:
    return {"code": code, "message": message, "retryable": retryable, "details": details}


def _unavailable(
    system: str, operation: str, code: str, message: str, *, retryable: bool, **details: Any
) -> SpecialistOutcome:
    return SpecialistOutcome(
        system=system,
        operation=operation,
        status="unavailable",
        error=_error(code, message, retryable=retryable, **details),
    )


def _failed(
    system: str, operation: str, code: str, message: str, *, retryable: bool = False, **details: Any
) -> SpecialistOutcome:
    return SpecialistOutcome(
        system=system,
        operation=operation,
        status="error",
        error=_error(code, message, retryable=retryable, **details),
    )


def _parse_capabilities(system: str, raw: object) -> CapabilitySnapshot:
    def invalid(reason: str) -> CapabilitySnapshot:
        return CapabilitySnapshot(
            system=system,
            available=False,
            error=_error("CONTRACT_VIOLATION", f"Invalid capabilities: {reason}"),
        )

    if not isinstance(raw, dict):
        return invalid("not an object")
    if raw.get("contract_version") != CONTRACT_VERSION or raw.get("system") != system:
        return invalid("contract_version/system mismatch")
    operations: dict[str, OperationSpec] = {}
    raw_ops = raw.get("operations")
    if not isinstance(raw_ops, list):
        return invalid("operations must be a list")
    for item in raw_ops:
        if not isinstance(item, dict):
            return invalid("operation entry must be an object")
        name = item.get("name")
        schema = item.get("input_schema", {})
        side_effects = item.get("side_effects")
        requires_approval = item.get("requires_approval")
        timeout_s = item.get("timeout_s")
        if not isinstance(name, str) or not OPERATION_RE.fullmatch(name) or name in operations:
            return invalid("operation name missing, malformed or duplicated")
        if not isinstance(side_effects, bool) or not isinstance(requires_approval, bool):
            return invalid(f"{name}: side_effects/requires_approval must be booleans")
        if not isinstance(schema, dict):
            return invalid(f"{name}: input_schema must be an object")
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError:
            return invalid(f"{name}: input_schema is not a valid JSON Schema")
        if timeout_s is not None and (
            isinstance(timeout_s, bool) or not isinstance(timeout_s, (int, float)) or timeout_s <= 0
        ):
            return invalid(f"{name}: timeout_s must be a positive number")
        operations[name] = OperationSpec(
            name=name,
            side_effects=side_effects,
            requires_approval=requires_approval,
            input_schema=schema,
            timeout_s=float(timeout_s) if timeout_s is not None else None,
        )
    version = raw.get("version")
    return CapabilitySnapshot(
        system=system,
        available=True,
        version=version if isinstance(version, str) else None,
        operations=operations,
    )


class SpecialistAdapter(ABC):
    """Transport-independent specialist client. Subclasses implement ``_invoke``."""

    transport: str = "abstract"

    def __init__(self, system: str, *, retry: RetryPolicy | None = None) -> None:
        if system not in SPECIALIST_SYSTEMS:
            raise ValueError(f"Unknown specialist system: {system!r}")
        self.system = system
        self.retry = retry or RetryPolicy(
            max_attempts=3, base_delay_seconds=0.2, max_delay_seconds=2.0
        )
        self._capabilities: CapabilitySnapshot | None = None

    # ----------------------------------------------------------------- capabilities

    async def capabilities(self, *, refresh: bool = False) -> CapabilitySnapshot:
        """Validated capability declaration. Successful snapshots are cached."""
        if self._capabilities is not None and not refresh:
            return self._capabilities
        snapshot = await self._fetch_capabilities()
        if snapshot.available:
            self._capabilities = snapshot
        return snapshot

    async def operation_spec(self, operation: str) -> OperationSpec | CapabilitySnapshot:
        """The declared operation, or the (unavailable/incomplete) snapshot explaining why not."""
        snapshot = await self.capabilities()
        if snapshot.available and operation in snapshot.operations:
            return snapshot.operations[operation]
        return snapshot

    @abstractmethod
    async def _fetch_capabilities(self) -> CapabilitySnapshot: ...

    # ----------------------------------------------------------------- call

    @abstractmethod
    async def _invoke(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        run_id: str,
        correlation_id: str,
        idempotency_key: str | None,
        trace: TraceContext | None,
        timeout_s: float,
    ) -> SpecialistOutcome | object:
        """Return either a ready outcome (transport failure) or the raw decoded envelope."""

    async def call(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        run_id: str,
        correlation_id: str,
        idempotency_key: str | None = None,
        trace: TraceContext | None = None,
        timeout_s: float = 30.0,
        retry_safe: bool = False,
    ) -> SpecialistOutcome:
        """Call one specialist operation.

        ``retry_safe`` must only be True for read-only operations or when the
        receiver de-duplicates by ``idempotency_key``; otherwise exactly one
        attempt is made.
        """
        if not isinstance(operation, str) or not OPERATION_RE.fullmatch(operation):
            return _failed(self.system, str(operation)[:64], "INVALID_OPERATION",
                           "Operation name does not match the makma.v1 pattern.")
        if not isinstance(payload, dict):
            return _failed(self.system, operation, "INVALID_INPUT", "Payload must be an object.")
        try:
            json.dumps(payload, allow_nan=False)
        except (TypeError, ValueError):
            return _failed(self.system, operation, "INVALID_INPUT",
                           "Payload must be JSON-serialisable without NaN/Infinity.")
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")

        max_attempts = self.retry.max_attempts if retry_safe else 1
        outcome: SpecialistOutcome | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                async with asyncio.timeout(timeout_s):
                    raw = await self._invoke(
                        operation,
                        payload,
                        run_id=run_id,
                        correlation_id=correlation_id,
                        idempotency_key=idempotency_key,
                        trace=trace,
                        timeout_s=timeout_s,
                    )
            except TimeoutError:
                raw = _failed(self.system, operation, "TIMEOUT",
                              f"Specialist did not answer within {timeout_s}s.", retryable=True)
            outcome = (
                raw
                if isinstance(raw, SpecialistOutcome)
                else self._accept(raw, operation, run_id=run_id, correlation_id=correlation_id)
            )
            outcome = SpecialistOutcome(
                system=outcome.system,
                operation=outcome.operation,
                status=outcome.status,
                envelope=outcome.envelope,
                error=outcome.error,
                attempts=attempt,
            )
            if not outcome.retryable or attempt >= max_attempts:
                break
            await asyncio.sleep(self.retry.delay_for_attempt(attempt))
        assert outcome is not None
        return outcome

    def _accept(
        self, raw: object, operation: str, *, run_id: str, correlation_id: str
    ) -> SpecialistOutcome:
        violations = validate_envelope(
            raw,
            expected_system=self.system,
            expected_operation=operation,
            expected_run_id=run_id,
            expected_correlation_id=correlation_id,
        )
        if violations:
            return _failed(
                self.system,
                operation,
                "CONTRACT_VIOLATION",
                "Specialist response is not a valid makma.v1 envelope for this request.",
                violations=violations,
            )
        assert isinstance(raw, dict)
        status = raw["status"]
        return SpecialistOutcome(
            system=self.system,
            operation=operation,
            status=status,
            envelope=raw,
            error=raw["error"] if status != "ok" else None,
        )


class UnavailableSpecialist(SpecialistAdapter):
    """Placeholder for a specialist that is not configured or could not be loaded."""

    transport = "none"

    def __init__(self, system: str, reason: str) -> None:
        super().__init__(system)
        self.reason = reason

    async def _fetch_capabilities(self) -> CapabilitySnapshot:
        return CapabilitySnapshot(
            system=self.system,
            available=False,
            error=_error("SPECIALIST_UNAVAILABLE", self.reason),
        )

    async def _invoke(self, operation: str, payload: dict[str, Any], **_: Any) -> SpecialistOutcome:
        return _unavailable(self.system, operation, "SPECIALIST_UNAVAILABLE", self.reason,
                            retryable=False)


RunOperation = Callable[..., Any]


class InProcessSpecialistAdapter(SpecialistAdapter):
    """Calls a specialist's ``run_operation`` in the orchestrator process.

    Synchronous callables run in a worker thread so the event loop stays responsive.
    A timeout stops *waiting*; Python cannot pre-empt the worker thread, so a
    timed-out synchronous operation may still finish in the background.
    """

    transport = "in_process"

    def __init__(
        self,
        system: str,
        run_operation: RunOperation,
        capabilities: Callable[[], Any] | None = None,
        *,
        retry: RetryPolicy | None = None,
    ) -> None:
        super().__init__(system, retry=retry)
        self._run_operation = run_operation
        self._capabilities_fn = capabilities

    @classmethod
    def from_module(cls, system: str, module_name: str) -> SpecialistAdapter:
        try:
            module = importlib.import_module(module_name)
        except ImportError as error:
            return UnavailableSpecialist(
                system, f"Module {module_name!r} could not be imported ({type(error).__name__})."
            )
        run_operation = getattr(module, "run_operation", None)
        if not callable(run_operation):
            return UnavailableSpecialist(system, f"{module_name}.run_operation is missing.")
        return cls(system, run_operation, getattr(module, "capabilities", None))

    async def _call_maybe_async(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        if inspect.iscoroutinefunction(fn):
            return await fn(*args, **kwargs)
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def _fetch_capabilities(self) -> CapabilitySnapshot:
        if self._capabilities_fn is None:
            return CapabilitySnapshot(
                system=self.system,
                available=False,
                error=_error("CAPABILITIES_MISSING", "Specialist exposes no capabilities()."),
            )
        try:
            raw = await self._call_maybe_async(self._capabilities_fn)
        except Exception as error:
            return CapabilitySnapshot(
                system=self.system,
                available=False,
                error=_error(
                    "SPECIALIST_EXCEPTION", f"capabilities() raised {type(error).__name__}."
                ),
            )
        return _parse_capabilities(self.system, raw)

    async def _invoke(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        run_id: str,
        correlation_id: str,
        idempotency_key: str | None,
        trace: TraceContext | None,
        timeout_s: float,
    ) -> SpecialistOutcome | object:
        del idempotency_key, trace, timeout_s  # not part of the in-process signature
        try:
            # Deep-copy through JSON so the specialist cannot mutate orchestrator state
            # and so the returned value is exactly what an HTTP client would receive.
            raw = await self._call_maybe_async(
                self._run_operation,
                operation,
                json.loads(json.dumps(payload)),
                run_id=run_id,
                correlation_id=correlation_id,
            )
            return json.loads(json.dumps(raw, allow_nan=False))
        except (TypeError, ValueError):
            return _failed(self.system, operation, "CONTRACT_VIOLATION",
                           "Specialist returned a value that is not strict JSON.")
        except Exception as error:
            return _failed(self.system, operation, "SPECIALIST_EXCEPTION",
                           f"run_operation raised {type(error).__name__}.")


def _is_loopback(host: str) -> bool:
    if host == "localhost" or host.endswith(".localhost"):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class HttpSpecialistAdapter(SpecialistAdapter):
    """``POST {base_url}/v1/ops/{operation}`` with the payload as the JSON body.

    Run/correlation/trace identifiers travel as headers (``X-Makma-Run-Id``,
    ``X-Makma-Correlation-Id``, ``traceparent``, ``Idempotency-Key``). Set
    ``wrap_payload=True`` to send ``{"payload": ..., "run_id": ..., "correlation_id": ...}``
    instead if a specialist expects identifiers in the body.
    """

    transport = "http"

    def __init__(
        self,
        system: str,
        base_url: str,
        *,
        token_env: str | None = None,
        timeout_s: float = 30.0,
        retry: RetryPolicy | None = None,
        wrap_payload: bool = False,
        transport: httpx.AsyncBaseTransport | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(system, retry=retry)
        parts = urlsplit(base_url)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            raise ValueError("Specialist base_url must be an absolute http(s) URL.")
        if parts.username or parts.password or parts.query or parts.fragment:
            raise ValueError("Specialist base_url must not contain credentials, query or fragment.")
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")
        self.base_url = base_url.rstrip("/")
        self._scheme = parts.scheme
        self._host = parts.hostname
        self.token_env = token_env
        self.timeout_s = timeout_s
        self.wrap_payload = wrap_payload
        self._transport = transport
        self._environ = environ if environ is not None else os.environ

    def _token(self) -> tuple[str | None, SpecialistOutcome | None]:
        if self.token_env is None:
            return None, None
        token = self._environ.get(self.token_env)
        if not token:
            return None, _unavailable(
                self.system, "", "SPECIALIST_CREDENTIALS_MISSING",
                f"Environment variable {self.token_env} is not set.", retryable=False,
            )
        if self._scheme == "http" and not _is_loopback(self._host):
            return None, _unavailable(
                self.system, "", "INSECURE_TRANSPORT",
                "Refusing to send a bearer token over plain HTTP to a non-loopback host.",
                retryable=False,
            )
        return token, None

    def _client(self, timeout_s: float) -> httpx.AsyncClient:
        # follow_redirects=False: a redirect must never carry the bearer token elsewhere.
        # trust_env=False: ignore proxy variables and ~/.netrc credential injection.
        return httpx.AsyncClient(
            timeout=timeout_s,
            follow_redirects=False,
            trust_env=False,
            transport=self._transport,
        )

    async def _read_json(self, response: httpx.Response) -> object:
        size = 0
        chunks: list[bytes] = []
        async for chunk in response.aiter_bytes():
            size += len(chunk)
            if size > MAX_RESPONSE_BYTES:
                raise OverflowError
            chunks.append(chunk)
        return json.loads(b"".join(chunks).decode("utf-8"))

    def _classify_transport_error(
        self, operation: str, error: httpx.HTTPError
    ) -> SpecialistOutcome:
        if isinstance(error, (httpx.ConnectError, httpx.ConnectTimeout)):
            return _unavailable(self.system, operation, "SPECIALIST_UNAVAILABLE",
                                f"Could not connect ({type(error).__name__}).", retryable=True)
        if isinstance(error, httpx.TimeoutException):
            return _failed(self.system, operation, "TIMEOUT",
                           f"Specialist timed out ({type(error).__name__}).", retryable=True)
        return _unavailable(self.system, operation, "SPECIALIST_UNAVAILABLE",
                            f"Transport failure ({type(error).__name__}).", retryable=True)

    async def _fetch_capabilities(self) -> CapabilitySnapshot:
        token, problem = self._token()
        if problem is not None:
            return CapabilitySnapshot(system=self.system, available=False, error=problem.error)
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with self._client(self.timeout_s) as client, client.stream(
                "GET", f"{self.base_url}/v1/capabilities", headers=headers
            ) as response:
                if response.status_code != 200:
                    return CapabilitySnapshot(
                        system=self.system,
                        available=False,
                        error=_error("SPECIALIST_UNAVAILABLE",
                                     f"Capabilities returned HTTP {response.status_code}.",
                                     http_status=response.status_code),
                    )
                raw = await self._read_json(response)
        except httpx.HTTPError as error:
            outcome = self._classify_transport_error("capabilities", error)
            return CapabilitySnapshot(system=self.system, available=False, error=outcome.error)
        except (OverflowError, ValueError):
            return CapabilitySnapshot(
                system=self.system,
                available=False,
                error=_error("CONTRACT_VIOLATION", "Capabilities response is not valid JSON."),
            )
        return _parse_capabilities(self.system, raw)

    async def _invoke(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        run_id: str,
        correlation_id: str,
        idempotency_key: str | None,
        trace: TraceContext | None,
        timeout_s: float,
    ) -> SpecialistOutcome | object:
        token, problem = self._token()
        if problem is not None:
            return SpecialistOutcome(
                system=self.system, operation=operation, status=problem.status, error=problem.error
            )
        headers = {
            "Accept": "application/json",
            "X-Makma-Run-Id": run_id,
            "X-Makma-Correlation-Id": correlation_id,
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if trace is not None:
            headers["traceparent"] = trace.traceparent()
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        body: dict[str, Any] = (
            {"payload": payload, "run_id": run_id, "correlation_id": correlation_id}
            if self.wrap_payload
            else payload
        )
        try:
            async with self._client(min(timeout_s, self.timeout_s)) as client, client.stream(
                "POST", f"{self.base_url}/v1/ops/{operation}", headers=headers, json=body
            ) as response:
                status = response.status_code
                if 300 <= status < 400:
                    return _failed(self.system, operation, "REDIRECT_REFUSED",
                                   "Specialist answered with a redirect; redirects are not "
                                   "followed for authenticated calls.", http_status=status)
                try:
                    raw = await self._read_json(response)
                except OverflowError:
                    return _failed(self.system, operation, "CONTRACT_VIOLATION",
                                   "Specialist response exceeds the size limit.")
                except ValueError:
                    raw = None
        except httpx.HTTPError as error:
            return self._classify_transport_error(operation, error)

        if isinstance(raw, dict) and raw.get("contract_version") == CONTRACT_VERSION:
            return raw  # validated by SpecialistAdapter._accept regardless of HTTP status
        if status in {401, 403}:
            return _failed(self.system, operation, "SPECIALIST_UNAUTHORIZED",
                           "Specialist rejected the orchestrator credentials.", http_status=status)
        if status in _RETRYABLE_HTTP:
            return _unavailable(self.system, operation, "SPECIALIST_UNAVAILABLE",
                                f"Specialist returned HTTP {status}.", retryable=True,
                                http_status=status)
        if status >= 400:
            return _failed(self.system, operation, "SPECIALIST_HTTP_ERROR",
                           f"Specialist returned HTTP {status} without an envelope.",
                           http_status=status)
        return _failed(self.system, operation, "CONTRACT_VIOLATION",
                       "Specialist response is not a makma.v1 envelope.", http_status=status)


class SpecialistRegistry:
    """System name -> adapter. Unregistered systems resolve to an honest unavailable adapter."""

    def __init__(self, adapters: list[SpecialistAdapter] | None = None) -> None:
        self._adapters: dict[str, SpecialistAdapter] = {}
        for adapter in adapters or []:
            self.register(adapter)

    def register(self, adapter: SpecialistAdapter) -> None:
        if adapter.system in self._adapters:
            raise ValueError(f"Specialist {adapter.system!r} is already registered.")
        self._adapters[adapter.system] = adapter

    def get(self, system: str) -> SpecialistAdapter:
        adapter = self._adapters.get(system)
        if adapter is not None:
            return adapter
        if system not in SPECIALIST_SYSTEMS:
            raise ValueError(f"Unknown specialist system: {system!r}")
        return UnavailableSpecialist(system, "Specialist is not configured.")

    @property
    def configured(self) -> list[str]:
        return sorted(self._adapters)

    async def status(self) -> list[dict[str, Any]]:
        """Live availability of every known specialist (capabilities probe)."""
        rows = []
        for system in SPECIALIST_SYSTEMS:
            adapter = self.get(system)
            snapshot = await adapter.capabilities(refresh=True)
            rows.append(
                {
                    "system": system,
                    "transport": adapter.transport,
                    "state": "available" if snapshot.available else "unavailable",
                    "version": snapshot.version,
                    "operations": sorted(snapshot.operations),
                    "error": snapshot.error,
                }
            )
        return rows

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> SpecialistRegistry:
        """Configure HTTP specialists from ``MAKMA_SPECIALIST_<SYSTEM>_URL``.

        The bearer token is read at call time from ``MAKMA_SPECIALIST_<SYSTEM>_TOKEN``
        when that variable exists at configuration time; it is never stored here.
        """
        env = environ if environ is not None else os.environ
        registry = cls()
        for system in SPECIALIST_SYSTEMS:
            prefix = "MAKMA_SPECIALIST_" + system.upper().replace("-", "_")
            url = env.get(prefix + "_URL")
            if not url:
                continue
            token_env = prefix + "_TOKEN" if env.get(prefix + "_TOKEN") else None
            registry.register(
                HttpSpecialistAdapter(
                    system, url, token_env=token_env, transport=transport, environ=env
                )
            )
        return registry
