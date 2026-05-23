"""Direct Dynatrace API tools — replaces McpToolset for Agent Engine.

McpToolset with StreamableHTTPConnectionParams uses anyio cancel scopes that
cannot be cleaned up across task boundaries in Agent Engine's async runtime,
causing "Attempted to exit cancel scope in a different task" on every call.

These are plain synchronous httpx functions with no anyio dependency. They
work correctly in any async context because the httpx.Client runs in the
calling thread without creating anyio tasks.

OTel instrumentation: every execute_dql call emits a karma.dql_query span
with the query preview, result state, record count, and duration.  When called
from within a gen_ai.tool.call span (set up by otel_callbacks), the DQL span
is automatically nested as a child of the tool span so Dynatrace shows the
full trace hierarchy.
"""
from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

from karma.config import settings
from karma.otel import SPAN_DQL_QUERY, get_tracer

logger = structlog.get_logger(__name__)

_TIMEOUT = 55.0   # seconds — requestTimeoutMilliseconds max is 60000; keep under that
_POLL_TIMEOUT = 30.0  # seconds per poll request
_MAX_POLLS = 20  # 20 × 3s = 60s max wait


def execute_dql(query: str) -> dict[str, Any]:
    """Execute a DQL query against Dynatrace Grail and return results.

    This is the primary Dynatrace analysis tool. Use it to query spans, logs,
    metrics, timeseries, entities, events, and problems — everything the
    Dynatrace platform stores.

    Args:
        query: A valid DQL statement. Examples:

            Service latency percentiles (timeseries can only filter entity fields like dt.entity.service;
            do NOT use span.name, db.system, http.url etc. in timeseries filters):
              timeseries p50=percentile(duration,50), p95=percentile(duration,95), from:now()-14d, by:{dt.entity.service}
              | filter dt.entity.service == "SERVICE-XXX"

            Per-endpoint latency (use fetch spans when filtering by span.name or other span attributes):
              fetch spans, from:now()-14d
              | filter dt.entity.service == "SERVICE-XXX" and span.name == "POST /charge"
              | summarize p50=percentile(duration,50), p95=percentile(duration,95), by:bin(timestamp,1h)

            Throughput (use fetch+summarize — count() in timeseries requires a metric key, not span data):
              fetch spans, from:now()-14d
              | filter dt.entity.service == "SERVICE-XXX"
              | filter span.kind == "SERVER"
              | summarize requests=count(), by:bin(timestamp, 1h)

            Resolve entity ID:
              fetch dt.entity.service
              | filter entity.name == "svc-payments-v2"
              | fields entity.id, entity.name
              | limit 5

            Error logs:
              fetch logs, from:now()-14d
              | filter dt.entity.service == "SERVICE-XXX"
              | filter loglevel == "ERROR"
              | fields timestamp, content
              | limit 100

            Davis problems:
              fetch events(type:problem), from:now()-2h
              | filter affectedEntityIds contains "SERVICE-XXX"
              | fields event.id, event.title, event.status

            Redis/DB side effects via spans:
              fetch spans, from:now()-14d
              | filter dt.entity.service == "SERVICE-XXX"
              | filter isNotNull(db.system)
              | fields timestamp, db.system, db.operation, db.statement
              | limit 200

    Returns:
        On success: {"state": "SUCCEEDED", "result": {"records": [...], ...}}
        On error:   {"error": "<message>", "detail": "<optional detail>"}
    """
    tracer = get_tracer("karma.tools")

    with tracer.start_as_current_span(SPAN_DQL_QUERY) as span:
        span.set_attribute("gen_ai.tool.name", "execute_dql")
        span.set_attribute("gen_ai.system", "google_vertex")
        span.set_attribute("karma.dql.query_preview", query[:300])
        span.set_attribute("karma.dql.query_length", len(query))

        if not settings.dt_env or not settings.dt_api_token:
            err = (
                "Dynatrace not configured — DT_ENV or DT_API_TOKEN missing. "
                "Set these environment variables and redeploy the agent."
            )
            span.set_attribute("karma.dql.error", err)
            try:
                from opentelemetry.trace import Status, StatusCode
                span.set_status(Status(StatusCode.ERROR, err))
            except ImportError:
                pass
            return {"error": err}

        url = f"{settings.dt_base_url}/platform/storage/query/v1/query:execute"
        headers = {
            "Authorization": f"Bearer {settings.dt_api_token}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {
            "query": query,
            "requestTimeoutMilliseconds": int(_TIMEOUT * 1000),
            "maxResultRecords": 1000,
        }

        t0 = time.perf_counter()
        try:
            with httpx.Client(timeout=_TIMEOUT + 10) as client:
                resp = client.post(url, json=body, headers=headers)

            elapsed = time.perf_counter() - t0
            span.set_attribute("karma.dql.http_status", resp.status_code)
            span.set_attribute("karma.dql.duration_seconds", round(elapsed, 4))

            if not resp.is_success:
                logger.warning(
                    "execute_dql_http_error",
                    status=resp.status_code,
                    query_prefix=query[:80],
                )
                err_msg = f"DQL request failed: HTTP {resp.status_code}"
                span.set_attribute("karma.dql.error", err_msg)
                try:
                    from opentelemetry.trace import Status, StatusCode
                    span.set_status(Status(StatusCode.ERROR, err_msg))
                except ImportError:
                    pass
                return {"error": err_msg, "detail": resp.text[:500]}

            data: dict[str, Any] = resp.json()
            state = data.get("state")

            # Grail returns results immediately when they're ready.
            if state == "SUCCEEDED" or "result" in data:
                records = data.get("result", {}).get("records", [])
                span.set_attribute("karma.dql.state", state or "SUCCEEDED")
                span.set_attribute("karma.dql.record_count", len(records))
                try:
                    from opentelemetry.trace import Status, StatusCode
                    span.set_status(Status(StatusCode.OK))
                except ImportError:
                    pass
                return data

            token = data.get("requestToken")
            if token:
                span.set_attribute("karma.dql.async_poll", True)
                result = _poll_dql(token, headers, span)
                return result

            return data

        except Exception as exc:
            elapsed = time.perf_counter() - t0
            span.set_attribute("karma.dql.duration_seconds", round(elapsed, 4))
            span.set_attribute("karma.dql.error", str(exc)[:300])
            try:
                from opentelemetry.trace import Status, StatusCode
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                span.record_exception(exc)
            except ImportError:
                pass
            logger.error("execute_dql_exception", error=str(exc), query_prefix=query[:80])
            return {"error": str(exc)}


def _poll_dql(
    token: str,
    headers: dict[str, Any],
    span: Any = None,
) -> dict[str, Any]:
    """Poll the Grail async DQL endpoint until the query completes."""
    poll_url = f"{settings.dt_base_url}/platform/storage/query/v1/query:poll"
    body = {"requestToken": token}

    for attempt in range(_MAX_POLLS):
        try:
            with httpx.Client(timeout=_POLL_TIMEOUT + 5) as client:
                resp = client.post(poll_url, json=body, headers=headers)

            if not resp.is_success:
                return {
                    "error": f"DQL poll failed: HTTP {resp.status_code}",
                    "detail": resp.text[:300],
                }

            data: dict[str, Any] = resp.json()
            state = data.get("state")

            if state == "SUCCEEDED":
                records = data.get("result", {}).get("records", [])
                if span is not None:
                    span.set_attribute("karma.dql.state", "SUCCEEDED")
                    span.set_attribute("karma.dql.record_count", len(records))
                    span.set_attribute("karma.dql.poll_attempts", attempt + 1)
                    try:
                        from opentelemetry.trace import Status, StatusCode
                        span.set_status(Status(StatusCode.OK))
                    except ImportError:
                        pass
                return data

            if state == "FAILED":
                if span is not None:
                    span.set_attribute("karma.dql.state", "FAILED")
                    try:
                        from opentelemetry.trace import Status, StatusCode
                        span.set_status(Status(StatusCode.ERROR, "DQL query failed server-side"))
                    except ImportError:
                        pass
                return {"error": "DQL query failed server-side", "detail": str(data)}

            time.sleep(3)

        except Exception as exc:
            return {"error": f"Poll exception: {exc}"}

    if span is not None:
        span.set_attribute("karma.dql.state", "TIMEOUT")
        try:
            from opentelemetry.trace import Status, StatusCode
            span.set_status(Status(StatusCode.ERROR, "DQL query timed out"))
        except ImportError:
            pass
    return {
        "error": f"DQL query timed out after {_MAX_POLLS * 3}s",
        "requestToken": token,
    }
