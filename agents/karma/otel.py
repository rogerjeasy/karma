"""OpenTelemetry setup and instrumentation primitives for Karma agents.

Configures TracerProvider and MeterProvider with OTLP/HTTP exporters targeting
Dynatrace. Uses the OpenTelemetry GenAI semantic conventions (gen_ai.*) so
Dynatrace's native AI Observability dashboards, token-spend panels, and model
latency charts work without any custom configuration.

Call setup_otel() once at process start (app.py does this) before any
instrumented code runs.  All downstream get_tracer() / get_meter() calls are
safe no-ops when the SDK is not installed or the endpoint is missing.
"""
from __future__ import annotations

import atexit
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

# ── Service identity ─────────────────────────────────────────────────────────

SERVICE_NAME = "karma-agent-system"
SERVICE_VERSION = "1.0.0"

# ── Span name constants (OpenTelemetry GenAI semantic conventions) ────────────

SPAN_AGENT_RUN = "karma.agent_run"          # wraps entire agent invocation
SPAN_MODEL_CALL = "gen_ai.chat"             # standard GenAI span name
SPAN_TOOL_CALL = "gen_ai.tool.call"         # standard GenAI tool span
SPAN_DQL_QUERY = "karma.dql_query"          # Dynatrace Grail DQL execution
SPAN_MCP_TOOL = "karma.mcp_tool_call"       # Dynatrace MCP gateway call

# ── Metric name constants (OpenTelemetry GenAI semantic conventions) ──────────

METRIC_INPUT_TOKENS = "gen_ai.usage.input_tokens"
METRIC_OUTPUT_TOKENS = "gen_ai.usage.output_tokens"
METRIC_TOTAL_TOKENS = "gen_ai.usage.total_tokens"
METRIC_CACHED_TOKENS = "gen_ai.usage.cache_read_input_tokens"
METRIC_COST_USD = "karma.estimated_cost_usd"
METRIC_OP_DURATION = "gen_ai.client.operation.duration"
METRIC_DQL_DURATION = "karma.dql_query.duration_seconds"
METRIC_MCP_DURATION = "karma.mcp_tool.duration_seconds"
METRIC_CONTRACTS_DISCOVERED = "karma.contracts_discovered.total"
METRIC_VIOLATIONS_DETECTED = "karma.violations_detected.total"
METRIC_GHOST_REPORTS = "karma.ghost_reports_created.total"
METRIC_TOOL_CALLS = "karma.tool_calls.total"
METRIC_TOOL_ERRORS = "karma.tool_errors.total"

# ── Token pricing (USD / 1M tokens — update as Vertex AI pricing changes) ────
# Source: https://cloud.google.com/vertex-ai/generative-ai/pricing (approx)

_PRICING: dict[str, dict[str, float]] = {
    "gemini-2.5-pro": {"input": 1.25, "output": 10.0, "cached": 0.3125},
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30, "cached": 0.01875},
    "gemini-2.5-pro-preview-05-06": {"input": 1.25, "output": 10.0, "cached": 0.3125},
    "gemini-2.5-flash-preview-04-17": {"input": 0.075, "output": 0.30, "cached": 0.01875},
    "gemini-2.0-flash": {"input": 0.075, "output": 0.30, "cached": 0.01875},
    "gemini-2.0-pro": {"input": 1.25, "output": 10.0, "cached": 0.3125},
}
_DEFAULT_PRICING = {"input": 1.0, "output": 5.0, "cached": 0.25}


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
) -> float:
    """Return estimated USD cost for a single LLM call."""
    # Normalise model name: strip version suffixes to match base model entries
    key = model
    if key not in _PRICING:
        # Try stripping after the last '-' version tag
        parts = key.rsplit("-", 1)
        if parts[0] in _PRICING:
            key = parts[0]
    p = _PRICING.get(key, _DEFAULT_PRICING)
    billable_input = max(0, input_tokens - cached_tokens)
    return (
        billable_input * p["input"] / 1_000_000
        + cached_tokens * p["cached"] / 1_000_000
        + output_tokens * p["output"] / 1_000_000
    )


# ── Provider singletons ───────────────────────────────────────────────────────

_configured = False
_config_lock = threading.Lock()
_tracer_provider: Any = None
_meter_provider: Any = None
_log_provider: Any = None

# Lazy instrument cache — created once per metric name
_instruments: dict[str, Any] = {}
_instrument_lock = threading.Lock()


def setup_otel(endpoint: str = "", token: str = "") -> bool:
    """Configure OTel TracerProvider and MeterProvider with OTLP/HTTP exporters.

    Idempotent — safe to call multiple times; no-op after first success.
    Falls back silently when the SDK is not installed or endpoint is missing.

    Args:
        endpoint: OTLP base URL, e.g. https://<dt>.live.dynatrace.com/api/v2/otlp
                  Falls back to OTEL_EXPORTER_OTLP_ENDPOINT env var.
        token: Dynatrace API token with openTelemetryTrace.ingest scope.
               Falls back to DT_OTEL_TOKEN / DT_API_TOKEN env vars.

    Returns:
        True if providers were successfully configured, False if skipped.
    """
    global _configured, _tracer_provider, _meter_provider

    with _config_lock:
        if _configured:
            return True

        import os

        endpoint = endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
        token = token or os.getenv("DT_OTEL_TOKEN", "") or os.getenv("DT_API_TOKEN", "")

        if not endpoint:
            logger.warning(
                "karma_otel_disabled — set OTEL_EXPORTER_OTLP_ENDPOINT to enable "
                "distributed tracing and token-spend metrics in Dynatrace"
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
                # Standard service attributes
                "service.name": SERVICE_NAME,
                "service.version": SERVICE_VERSION,
                "service.namespace": "karma",
                # GenAI semantic convention — Dynatrace uses this to identify the AI backend
                "gen_ai.system": "google_vertex",
                # Cloud attributes — enables Dynatrace entity correlation
                "cloud.provider": "gcp",
                "cloud.platform": "gcp_vertex_ai",
            })

            # ── Traces ────────────────────────────────────────────────────────
            span_exporter = OTLPSpanExporter(
                endpoint=f"{base}/v1/traces",
                headers=headers,
            )
            tp = TracerProvider(resource=resource)
            tp.add_span_processor(
                BatchSpanProcessor(
                    span_exporter,
                    max_queue_size=4096,
                    max_export_batch_size=512,
                    schedule_delay_millis=5_000,
                )
            )
            trace.set_tracer_provider(tp)
            _tracer_provider = tp

            # ── Metrics ───────────────────────────────────────────────────────
            # 30-second interval: fast enough to see live demo data in Dynatrace
            metric_exporter = OTLPMetricExporter(
                endpoint=f"{base}/v1/metrics",
                headers=headers,
            )
            mp = MeterProvider(
                resource=resource,
                metric_readers=[
                    PeriodicExportingMetricReader(
                        metric_exporter,
                        export_interval_millis=30_000,
                    )
                ],
            )
            metrics.set_meter_provider(mp)
            _meter_provider = mp

            # ── Logs ──────────────────────────────────────────────────────────
            # Exports Python stdlib logging records to Dynatrace so the
            # hackathon requirement of "traces, metrics, AND logs" is satisfied.
            try:
                import logging as _logging

                from opentelemetry._logs import set_logger_provider
                from opentelemetry.exporter.otlp.proto.http.log_exporter import (
                    OTLPLogExporter,
                )
                from opentelemetry.sdk.logs import LoggerProvider, LoggingHandler
                from opentelemetry.sdk.logs.export import BatchLogRecordProcessor

                lp = LoggerProvider(resource=resource)
                lp.add_log_record_processor(
                    BatchLogRecordProcessor(
                        OTLPLogExporter(endpoint=f"{base}/v1/logs", headers=headers)
                    )
                )
                set_logger_provider(lp)
                global _log_provider
                _log_provider = lp

                # Bridge stdlib logging → OTel so structlog (via stdlib) and any
                # direct logging.getLogger() calls appear in Dynatrace Logs.
                _handler = LoggingHandler(level=_logging.INFO, logger_provider=lp)
                _root = _logging.getLogger()
                if not any(isinstance(h, LoggingHandler) for h in _root.handlers):
                    _root.addHandler(_handler)

                # Route structlog through stdlib so its records reach OTel.
                import structlog as _structlog
                _structlog.configure(
                    logger_factory=_structlog.stdlib.LoggerFactory(),
                    wrapper_class=_structlog.stdlib.BoundLogger,
                )
            except Exception as _log_exc:
                logger.warning("karma_otel_logs_skip: %s", _log_exc)

            atexit.register(_shutdown_otel)

            _configured = True
            logger.info(
                "karma_otel_configured service=%s endpoint=%s",
                SERVICE_NAME,
                endpoint,
            )
            return True

        except ImportError as exc:
            logger.warning("karma_otel_skip — OTel SDK not installed: %s", exc)
            return False
        except Exception as exc:
            logger.error("karma_otel_init_failed: %s", exc)
            return False


def _shutdown_otel() -> None:
    """Flush and shut down providers on process exit."""
    for provider in [_tracer_provider, _meter_provider, _log_provider]:
        if provider is None:
            continue
        try:
            provider.force_flush(timeout_millis=10_000)
            provider.shutdown()
        except Exception:
            pass


# ── Tracer / meter accessors ──────────────────────────────────────────────────


def get_tracer(name: str = "karma") -> Any:
    """Return an OTel tracer bound to the Karma schema URL.

    Returns a silent no-op tracer if the SDK is not installed.
    """
    try:
        from opentelemetry import trace
        return trace.get_tracer(
            name,
            schema_url="https://opentelemetry.io/schemas/1.27.0",
        )
    except ImportError:
        return _NoOpTracer()


def get_meter(name: str = "karma") -> Any:
    """Return an OTel meter bound to the Karma schema URL.

    Returns a silent no-op meter if the SDK is not installed.
    """
    try:
        from opentelemetry import metrics
        return metrics.get_meter(
            name,
            schema_url="https://opentelemetry.io/schemas/1.27.0",
        )
    except ImportError:
        return _NoOpMeter()


# ── Lazy metric instrument factory ────────────────────────────────────────────


def _counter(name: str, description: str = "", unit: str = "{token}") -> Any:
    """Return (or lazily create) a named OTel counter instrument."""
    with _instrument_lock:
        if name not in _instruments:
            _instruments[name] = get_meter().create_counter(
                name, description=description, unit=unit
            )
    return _instruments[name]


def _histogram(name: str, description: str = "", unit: str = "s") -> Any:
    """Return (or lazily create) a named OTel histogram instrument."""
    with _instrument_lock:
        if name not in _instruments:
            _instruments[name] = get_meter().create_histogram(
                name, description=description, unit=unit
            )
    return _instruments[name]


# ── High-level metric helpers ─────────────────────────────────────────────────


def record_token_usage(
    model: str,
    agent: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
) -> float:
    """Record all token usage metrics for one LLM call and return estimated USD cost.

    Emits five metrics using the OpenTelemetry GenAI semantic conventions:
      gen_ai.usage.input_tokens          — prompt tokens sent to the model
      gen_ai.usage.output_tokens         — tokens in the model's response
      gen_ai.usage.total_tokens          — sum (for quick dashboard queries)
      gen_ai.usage.cache_read_input_tokens — cached tokens (lower billing rate)
      karma.estimated_cost_usd           — derived from Vertex AI pricing table

    Dynatrace displays these in its AI Observability token-spend panels when
    the resource attributes gen_ai.system and service.name are present.
    """
    attrs: dict[str, Any] = {
        "gen_ai.system": "google_vertex",
        "gen_ai.request.model": model,
        "karma.agent": agent,
    }

    _counter(
        METRIC_INPUT_TOKENS,
        "Input (prompt) tokens consumed by Karma agents",
    ).add(input_tokens, attrs)

    _counter(
        METRIC_OUTPUT_TOKENS,
        "Output (completion) tokens generated by Karma agents",
    ).add(output_tokens, attrs)

    _counter(
        METRIC_TOTAL_TOKENS,
        "Total tokens (input + output) per Karma agent",
    ).add(input_tokens + output_tokens, attrs)

    if cached_tokens > 0:
        _counter(
            METRIC_CACHED_TOKENS,
            "Cached input tokens (billed at reduced rate)",
        ).add(cached_tokens, attrs)

    cost = estimate_cost(model, input_tokens, output_tokens, cached_tokens)
    _counter(
        METRIC_COST_USD,
        "Estimated Vertex AI GenAI cost in USD",
        unit="USD",
    ).add(cost, attrs)

    return cost


def record_business_metric(
    metric: str,
    value: int = 1,
    attrs: dict[str, Any] | None = None,
) -> None:
    """Record a Karma business event counter (contracts, violations, ghost reports).

    Call this alongside emit_karma_event so the same events are visible both
    in Dynatrace Grail (via BizEvents) and in OTel metric dashboards.
    """
    _descriptions = {
        METRIC_CONTRACTS_DISCOVERED: "Implicit contracts discovered by Karma Learner",
        METRIC_VIOLATIONS_DETECTED: "Contract violations detected by Karma Watcher",
        METRIC_GHOST_REPORTS: "Ghost reports created by Karma Forensic",
        METRIC_TOOL_CALLS: "Total ADK tool calls made by Karma agents",
        METRIC_TOOL_ERRORS: "ADK tool calls that returned an error",
    }
    _counter(
        metric,
        _descriptions.get(metric, ""),
        unit="{event}",
    ).add(value, attrs or {})


# ── No-op fallbacks (used when SDK is not installed) ─────────────────────────


class _NoOpSpan:
    """Silent stand-in for opentelemetry.trace.Span."""

    def set_attribute(self, key: str, value: Any) -> None: ...  # noqa: E704
    def set_status(self, status: Any) -> None: ...
    def record_exception(self, exc: Exception, attributes: Any = None) -> None: ...
    def add_event(self, name: str, attributes: Any = None) -> None: ...
    def end(self) -> None: ...
    def __enter__(self) -> _NoOpSpan: return self
    def __exit__(self, *args: Any) -> None: ...
    def __bool__(self) -> bool: return False


class _NoOpTracer:
    """Silent stand-in for opentelemetry.trace.Tracer."""

    def start_as_current_span(self, name: str, **kwargs: Any) -> Any:
        from contextlib import nullcontext
        return nullcontext(_NoOpSpan())

    def start_span(self, name: str, **kwargs: Any) -> _NoOpSpan:
        return _NoOpSpan()


class _NoOpInstrument:
    def add(self, amount: Any, attributes: Any = None, **kwargs: Any) -> None: ...
    def record(self, amount: Any, attributes: Any = None, **kwargs: Any) -> None: ...


class _NoOpMeter:
    """Silent stand-in for opentelemetry.metrics.Meter."""

    def create_counter(self, *args: Any, **kwargs: Any) -> _NoOpInstrument:
        return _NoOpInstrument()

    def create_histogram(self, *args: Any, **kwargs: Any) -> _NoOpInstrument:
        return _NoOpInstrument()

    def create_up_down_counter(self, *args: Any, **kwargs: Any) -> _NoOpInstrument:
        return _NoOpInstrument()

    def create_observable_gauge(self, *args: Any, **kwargs: Any) -> _NoOpInstrument:
        return _NoOpInstrument()
