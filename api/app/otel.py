"""OpenTelemetry setup for the Karma API (FastAPI + Cloud Run).

Configures TracerProvider and MeterProvider with OTLP/HTTP exporters targeting
Dynatrace. Also instruments FastAPI (incoming HTTP spans) and HTTPX (outbound
calls to Vertex AI Agent Engine).

Call setup_otel(app) once during create_app() before the app starts serving.
All downstream trace/metric calls are safe no-ops when the endpoint is missing.
"""
from __future__ import annotations

import atexit
import logging
import threading
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger(__name__)

SERVICE_NAME = "karma-api"
SERVICE_VERSION = "0.1.0"

_configured = False
_config_lock = threading.Lock()
_tracer_provider: Any = None
_meter_provider: Any = None
_log_provider: Any = None


def setup_otel(app: FastAPI | None = None, endpoint: str = "", token: str = "") -> bool:
    """Configure OTel TracerProvider and MeterProvider with OTLP/HTTP exporters.

    Idempotent — safe to call multiple times; no-op after first success.
    Falls back silently when the endpoint is not configured.

    Args:
        app: FastAPI application instance to instrument (HTTP spans).
        endpoint: OTLP base URL. Falls back to OTEL_EXPORTER_OTLP_ENDPOINT env var,
                  then constructs from DT_ENV if set.
        token: DT API token. Falls back to DT_OTEL_TOKEN / DT_API_TOKEN env vars.

    Returns:
        True if providers were successfully configured, False if skipped.
    """
    global _configured, _tracer_provider, _meter_provider

    with _config_lock:
        if _configured:
            return True

        import os

        endpoint = (
            endpoint
            or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
            or _endpoint_from_env()
        )
        token = token or os.getenv("DT_OTEL_TOKEN", "") or os.getenv("DT_API_TOKEN", "")

        if not endpoint:
            logger.warning(
                "karma_api_otel_disabled — set OTEL_EXPORTER_OTLP_ENDPOINT "
                "or DT_ENV to enable distributed tracing in Dynatrace"
            )
            return False

        try:
            from opentelemetry import metrics, trace
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
            from opentelemetry.sdk.metrics import MeterProvider
            from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor

            headers: dict[str, str] = {}
            if token:
                headers["Authorization"] = f"Api-Token {token}"

            base = endpoint.rstrip("/")

            resource = Resource.create({
                "service.name": SERVICE_NAME,
                "service.version": SERVICE_VERSION,
                "service.namespace": "karma",
                "cloud.provider": "gcp",
                "cloud.platform": "gcp_cloud_run",
            })

            # ── Traces ────────────────────────────────────────────────────────
            tp = TracerProvider(resource=resource)
            tp.add_span_processor(
                BatchSpanProcessor(
                    OTLPSpanExporter(endpoint=f"{base}/v1/traces", headers=headers),
                    max_queue_size=4096,
                    max_export_batch_size=512,
                    schedule_delay_millis=5_000,
                )
            )
            trace.set_tracer_provider(tp)
            _tracer_provider = tp

            # ── Metrics ───────────────────────────────────────────────────────
            mp = MeterProvider(
                resource=resource,
                metric_readers=[
                    PeriodicExportingMetricReader(
                        OTLPMetricExporter(endpoint=f"{base}/v1/metrics", headers=headers),
                        export_interval_millis=30_000,
                    )
                ],
            )
            metrics.set_meter_provider(mp)
            _meter_provider = mp

            atexit.register(_shutdown_otel)

            # ── HTTP auto-instrumentation ─────────────────────────────────────
            if app is not None:
                try:
                    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
                    FastAPIInstrumentor.instrument_app(app, tracer_provider=tp)
                except ImportError:
                    logger.warning("karma_api_otel: FastAPIInstrumentor not installed")

            try:
                from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
                HTTPXClientInstrumentor().instrument(tracer_provider=tp)
            except ImportError:
                logger.warning("karma_api_otel: HTTPXClientInstrumentor not installed")

            # ── Logs ──────────────────────────────────────────────────────────
            try:
                import logging as _logging

                from opentelemetry._logs import set_logger_provider
                from opentelemetry.exporter.otlp.proto.http.log_exporter import (
                    OTLPLogExporter,
                )
                from opentelemetry.sdk.logs import LoggerProvider, LoggingHandler
                from opentelemetry.sdk.logs.export import BatchLogRecordProcessor

                global _log_provider
                lp = LoggerProvider(resource=resource)
                lp.add_log_record_processor(
                    BatchLogRecordProcessor(
                        OTLPLogExporter(endpoint=f"{base}/v1/logs", headers=headers)
                    )
                )
                set_logger_provider(lp)
                _log_provider = lp

                _handler = LoggingHandler(level=_logging.INFO, logger_provider=lp)
                _root = _logging.getLogger()
                if not any(isinstance(h, LoggingHandler) for h in _root.handlers):
                    _root.addHandler(_handler)

                import structlog as _structlog
                _structlog.configure(
                    logger_factory=_structlog.stdlib.LoggerFactory(),
                    wrapper_class=_structlog.stdlib.BoundLogger,
                )
            except Exception as _log_exc:
                logger.warning("karma_api_otel_logs_skip: %s", _log_exc)

            _configured = True
            logger.info("karma_api_otel_configured service=%s endpoint=%s", SERVICE_NAME, endpoint)
            return True

        except ImportError as exc:
            logger.warning("karma_api_otel_skip — OTel SDK not installed: %s", exc)
            return False
        except Exception as exc:
            logger.error("karma_api_otel_init_failed: %s", exc)
            return False


def _endpoint_from_env() -> str:
    import os
    dt_env = os.getenv("DT_ENV", "")
    if dt_env:
        return f"https://{dt_env}.live.dynatrace.com/api/v2/otlp"
    return ""


def _shutdown_otel() -> None:
    for provider in [_tracer_provider, _meter_provider, _log_provider]:
        if provider is None:
            continue
        try:
            provider.force_flush(timeout_millis=10_000)
            provider.shutdown()
        except Exception:
            pass
