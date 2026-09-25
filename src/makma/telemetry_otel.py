from __future__ import annotations

from collections.abc import Mapping

from makma.telemetry import TelemetryEvent


class OpenTelemetryMetricSink:
    """Export MAK'MA telemetry as OTLP metrics without making OTel mandatory."""

    def __init__(
        self,
        endpoint: str,
        *,
        service_name: str = "makma-ai-os",
        headers: Mapping[str, str] | None = None,
        export_interval_millis: int = 5000,
    ) -> None:
        if not endpoint.strip() or not service_name.strip():
            raise ValueError("endpoint and service_name are required.")
        if (
            isinstance(export_interval_millis, bool)
            or not isinstance(export_interval_millis, int)
            or export_interval_millis <= 0
        ):
            raise ValueError("export_interval_millis must be a positive integer.")
        try:
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
                OTLPMetricExporter,
            )
            from opentelemetry.sdk.metrics import MeterProvider
            from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
            from opentelemetry.sdk.resources import Resource
        except ImportError as error:
            raise RuntimeError(
                "OpenTelemetry export requires the observability optional extra."
            ) from error

        exporter = OTLPMetricExporter(endpoint=endpoint, headers=dict(headers or {}))
        reader = PeriodicExportingMetricReader(
            exporter,
            export_interval_millis=export_interval_millis,
        )
        provider = MeterProvider(
            resource=Resource.create({"service.name": service_name}),
            metric_readers=[reader],
        )
        meter = provider.get_meter("makma.runtime")
        self._provider = provider
        self._latency = meter.create_histogram(
            "makma.operation.latency",
            unit="ms",
            description="Observed MAK'MA runtime and tool latency.",
        )
        self._events = meter.create_counter(
            "makma.operation.events",
            unit="1",
            description="MAK'MA operation outcomes.",
        )
        self._cost = meter.create_counter(
            "makma.operation.cost",
            unit="USD",
            description="Estimated MAK'MA operation cost.",
        )

    def emit(self, event: TelemetryEvent) -> None:
        attributes = dict(event.attributes)
        attributes.update(
            {
                "makma.operation": event.operation,
                "makma.success": event.success,
            }
        )
        self._latency.record(event.latency_ms, attributes)
        self._events.add(1, attributes)
        if event.cost_usd:
            self._cost.add(event.cost_usd, attributes)

    def shutdown(self) -> None:
        self._provider.shutdown()
