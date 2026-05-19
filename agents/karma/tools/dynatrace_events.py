"""Dynatrace Logs Ingest client — self-observability for the Karma agent system.

The Dynatrace MCP server does not expose a write-events tool in its current
toolset. This module fills that gap via the Dynatrace Logs Ingest API v2,
emitting structured log records so every Karma decision is:
  - Persisted in Grail (queryable via DQL: fetch logs | filter log.source == "karma-agent")
  - Visible on Dynatrace dashboards
  - Part of the auditable evidence trail shown in the live demo

Required classic API token scope: logs.ingest
  (already included with the DT_OTEL_TOKEN — no new token needed)
Endpoint: settings.dt_logs_endpoint (derived from DT_ENV — never hardcoded)
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from karma.config import settings

logger = structlog.get_logger(__name__)

_LOG_SOURCE = "karma-agent"

# Canonical event type prefixes — all Karma events live under this namespace
KARMA_EVENT_PREFIX = "karma"

# Well-known event types emitted by Karma agents
EVENT_LEARNING_STARTED      = f"{KARMA_EVENT_PREFIX}.learning.started"
EVENT_CONTRACT_DISCOVERED   = f"{KARMA_EVENT_PREFIX}.contract.discovered"
EVENT_CONTRACT_VALIDATED    = f"{KARMA_EVENT_PREFIX}.contract.validated"
EVENT_CONTRACT_REJECTED     = f"{KARMA_EVENT_PREFIX}.contract.rejected"
EVENT_LEARNING_COMPLETE     = f"{KARMA_EVENT_PREFIX}.learning.complete"
EVENT_VIOLATION_DETECTED    = f"{KARMA_EVENT_PREFIX}.violation.detected"
EVENT_GHOST_REPORT_CREATED  = f"{KARMA_EVENT_PREFIX}.ghost_report.created"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def _post_log_record(
    records: list[dict[str, Any]],
    headers: dict[str, str],
) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0) as client:
        return await client.post(
            settings.dt_logs_endpoint,
            json=records,
            headers=headers,
        )


async def emit_karma_event(
    event_type: str,
    title: str,
    properties: dict[str, Any],
) -> dict[str, Any]:
    """Emit a Karma observation event to Dynatrace Logs (self-observability).

    Use this tool after completing a significant action so that Karma's
    decisions are visible inside Dynatrace and auditable during the demo.
    Events are queryable in Grail via:
      fetch logs | filter log.source == "karma-agent"

    Prefer the well-known event type constants defined in this module:
      - karma.learning.started
      - karma.contract.discovered
      - karma.contract.validated
      - karma.contract.rejected
      - karma.learning.complete
      - karma.violation.detected
      - karma.ghost_report.created

    Args:
        event_type: Dot-notation event type, must start with 'karma.'.
        title: Human-readable one-line summary shown on the Dynatrace dashboard.
        properties: Key-value pairs attached to the event. Keys must be
                    snake_case strings; values must be JSON-serialisable
                    primitives (str, int, float, bool) or lists/dicts of same.

    Returns:
        On success:  {'status': 'ok', 'event_id': '<uuid>'}
        On failure:  {'status': 'error', 'http_status': <n>, 'detail': '<text>'}
                     or {'status': 'error', 'detail': '<exception message>'}
    """
    if not event_type.startswith(f"{KARMA_EVENT_PREFIX}."):
        event_type = f"{KARMA_EVENT_PREFIX}.{event_type}"

    event_id = str(uuid.uuid4())
    timestamp = datetime.now(UTC).isoformat()

    # Logs Ingest API v2 — array of log records.
    # Flat key-value pairs; "content" is the human-readable body shown in the UI.
    record: dict[str, Any] = {
        "content": title,
        "timestamp": timestamp,
        "log.source": _LOG_SOURCE,
        "karma.event_id": event_id,
        "karma.event_type": event_type,
        "karma.title": title,
    }
    # Flatten caller properties under the "karma." namespace so they are
    # discoverable via DQL attribute selectors without colliding with
    # reserved Dynatrace log attributes.
    for key, value in properties.items():
        flat_key = key if key.startswith("karma.") else f"karma.{key}"
        if isinstance(value, (str, int, float, bool)):
            record[flat_key] = value
        else:
            # Complex values are serialised to string to stay within the
            # Logs Ingest API's attribute value type constraints.
            record[flat_key] = str(value)

    headers = {
        "Authorization": f"Api-Token {settings.dt_otel_token}",
        "Content-Type": "application/json; charset=utf-8",
    }

    log = logger.bind(event_type=event_type, event_id=event_id)
    log.info("emitting_karma_log_event")

    try:
        response = await _post_log_record([record], headers)
    except Exception as exc:
        log.error("karma_log_event_failed", error=str(exc))
        return {"status": "error", "detail": str(exc)}

    if response.is_success:
        log.info("karma_log_event_ok")
        return {"status": "ok", "event_id": event_id}

    log.warning(
        "karma_log_event_http_error",
        http_status=response.status_code,
        detail=response.text[:200],
    )
    return {
        "status": "error",
        "http_status": response.status_code,
        "detail": response.text[:500],
    }
