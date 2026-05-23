"""Dynatrace BizEvents Ingest client — self-observability for the Karma agent system.

Every significant Karma decision is emitted as a Dynatrace BizEvent so that:
  - Decisions are persisted in Grail (queryable via DQL: fetch bizevents)
  - Events appear on Dynatrace dashboards as business-process telemetry
  - Judges can verify the complete audit trail during the demo

Required classic API token scope: bizevents.ingest
  Add this scope to DT_OTEL_TOKEN in Dynatrace → Access Tokens → API Tokens.
  It is distinct from the platform scope (storage:bizevents:write) and is
  available on Dynatrace trials.

Endpoint: settings.dt_bizevents_endpoint (derived from DT_ENV — never hardcoded)

DQL to query all Karma events:
  fetch bizevents
  | filter startsWith(event.type, "karma.")
  | sort timestamp desc
  | limit 50
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
async def _post_bizevent(
    cloud_event: dict[str, Any],
    headers: dict[str, str],
) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0) as client:
        return await client.post(
            settings.dt_bizevents_endpoint,
            json=cloud_event,
            headers=headers,
        )


async def emit_karma_event(
    event_type: str,
    title: str,
    properties: dict[str, Any],
) -> dict[str, Any]:
    """Emit a Karma observation as a Dynatrace BizEvent (self-observability).

    Use this tool after completing a significant action so that Karma's
    decisions are visible inside Dynatrace as business-process events,
    auditable during the demo.

    BizEvents are queryable in Grail via:
      fetch bizevents | filter event.type == "karma.ghost_report.created"

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

    # Build the CloudEvents data payload.
    # Scalar properties are included directly; complex values are stringified
    # to stay within BizEvents attribute type constraints.
    data_payload: dict[str, Any] = {"title": title, "timestamp": datetime.now(UTC).isoformat()}
    for key, value in properties.items():
        if isinstance(value, (str, int, float, bool)):
            data_payload[key] = value
        else:
            data_payload[key] = str(value)

    # CloudEvents 1.0 format — required by the Dynatrace BizEvents Ingest API.
    cloud_event: dict[str, Any] = {
        "specversion": "1.0",
        "id": event_id,
        "source": "karma-agent",
        "type": event_type,
        "datacontenttype": "application/json",
        "data": data_payload,
    }

    if not settings.dt_otel_token:
        logger.warning("karma_bizevent_skipped", reason="DT_OTEL_TOKEN not configured")
        return {"status": "skipped", "detail": "DT_OTEL_TOKEN not configured"}

    headers = {
        "Authorization": f"Api-Token {settings.dt_otel_token}",
        "Content-Type": "application/cloudevents+json",
    }

    log = logger.bind(event_type=event_type, event_id=event_id)
    log.info("emitting_karma_bizevent")

    try:
        response = await _post_bizevent(cloud_event, headers)
    except Exception as exc:
        log.error("karma_bizevent_failed", error=str(exc))
        return {"status": "error", "detail": str(exc)}

    if response.is_success:
        log.info("karma_bizevent_ok")
        return {"status": "ok", "event_id": event_id}

    log.warning(
        "karma_bizevent_http_error",
        http_status=response.status_code,
        detail=response.text[:200],
    )
    return {
        "status": "error",
        "http_status": response.status_code,
        "detail": response.text[:500],
    }
