"""Dynatrace bidirectional integration and forensic session tools.

Two capabilities in one module:

1. push_ghost_report_to_dynatrace — Creates a CUSTOM_ANNOTATION event in the
   Dynatrace Events feed for the violated service. This makes Karma's ghost reports
   visible directly in the Dynatrace service problem timeline, creating a two-way
   link: Karma reads from Dynatrace (DQL/MCP) and Dynatrace shows Karma's output.

2. get_session_cost_estimate — Returns the accumulated token usage and estimated
   USD cost for the current forensic investigation session. Reads from the OTel
   span context set by otel_callbacks.before_tool_callback so the forensic agent
   can include operational cost in every ghost report.

Both functions are registered as ADK tools in the forensic agent.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from karma.config import settings

logger = structlog.get_logger(__name__)

_TIMEOUT = 15.0


# ── 1. Dynatrace Events push ──────────────────────────────────────────────────


def push_ghost_report_to_dynatrace(
    service_id: str,
    report_id: str,
    summary: str,
    severity: str,
    karma_service_id: str,
    contract_category: str = "",
    contract_subcategory: str = "",
    dashboard_url: str = "",
) -> dict[str, Any]:
    """Push a completed ghost report as a custom annotation into the Dynatrace Events feed.

    Creates a CUSTOM_ANNOTATION event on the violated service entity so SREs and
    judges can navigate from any Dynatrace service dashboard directly to the Karma
    ghost report.  The event appears on the service's problem timeline with a link
    back to the Karma dashboard.

    Call this AFTER save_ghost_report_to_firestore succeeds and capture the returned
    dynatrace_event_id to store in the ghost report.

    Required classic API token scope: events.ingest  (already in DT_OTEL_TOKEN)

    Args:
        service_id: Dynatrace entity ID of the violated service (e.g. "SERVICE-XXX").
        report_id: Karma ghost report UUID from save_ghost_report_to_firestore.
        summary: One-sentence summary of the violation (from the ghost report).
        severity: "low" | "medium" | "high" | "critical"
        karma_service_id: Karma service UUID (for deep link construction).
        contract_category: Contract category label (e.g. "side_effect").
        contract_subcategory: Fine-grained label (e.g. "cache_warming").
        dashboard_url: Optional Karma dashboard URL for the deep link.

    Returns:
        {"pushed": True, "dynatrace_event_id": "<id>", "event_type": "CUSTOM_ANNOTATION"}
        {"pushed": False, "error": "<reason>"}
    """
    if not settings.dt_env or not settings.dt_otel_token:
        return {"pushed": False, "error": "DT_ENV or DT_OTEL_TOKEN not configured"}

    now_ms = int(datetime.now(UTC).timestamp() * 1000)

    # Severity → Dynatrace annotation colour (informational by default; use
    # CUSTOM_ALERT for critical so it surfaces in the Problems feed)
    event_type = "CUSTOM_ALERT" if severity == "critical" else "CUSTOM_ANNOTATION"

    category_label = (
        f"{contract_category}/{contract_subcategory}"
        if contract_subcategory
        else contract_category or "unknown"
    )

    karma_link = dashboard_url or (
        f"https://karma-web-{settings.gcp_project_id}.run.app/dashboard/ghosts/{report_id}"
        if settings.gcp_project_id
        else ""
    )

    properties: dict[str, Any] = {
        "karma.report_id": report_id,
        "karma.service_id": karma_service_id,
        "karma.severity": severity,
        "karma.contract_category": category_label,
        "karma.summary": summary[:500],
        "karma.tool": "Karma Implicit Contract Monitor",
    }
    if karma_link:
        properties["karma.report_url"] = karma_link

    body: dict[str, Any] = {
        "eventType": event_type,
        "title": f"[Karma] {severity.upper()}: {category_label} contract violated — {summary[:120]}",
        "entitySelector": f'entityId("{service_id}")',
        "startTime": now_ms - 60_000,  # 1 minute ago (cover the analysis window)
        "endTime": now_ms,
        "properties": properties,
    }

    headers = {
        "Authorization": f"Api-Token {settings.dt_otel_token}",
        "Content-Type": "application/json",
    }

    log = logger.bind(report_id=report_id, service_id=service_id, severity=severity)
    log.info("pushing_ghost_report_to_dynatrace", event_type=event_type)

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(settings.dt_events_endpoint, json=body, headers=headers)

        if resp.is_success:
            data: dict[str, Any] = resp.json() if resp.content else {}
            # Dynatrace returns {"reportCount": 1} on success; grab any event IDs
            event_ids: list[dict[str, Any]] = data.get("eventIngestResults", [{}])
            dynatrace_event_id = (
                event_ids[0].get("correlationId", report_id)
                if event_ids
                else report_id
            )
            log.info("ghost_report_pushed_to_dynatrace", dynatrace_event_id=dynatrace_event_id)
            return {
                "pushed": True,
                "dynatrace_event_id": dynatrace_event_id,
                "event_type": event_type,
                "entity_selector": f'entityId("{service_id}")',
            }

        log.warning(
            "dynatrace_event_push_failed",
            http_status=resp.status_code,
            detail=resp.text[:300],
        )
        return {
            "pushed": False,
            "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    except Exception as exc:
        log.error("dynatrace_event_push_exception", error=str(exc))
        return {"pushed": False, "error": str(exc)}


# ── 2. Session cost estimation ────────────────────────────────────────────────


def get_session_cost_estimate() -> dict[str, Any]:
    """Return accumulated token usage and estimated USD cost for the current investigation.

    Reads the OTel span context set by otel_callbacks.before_tool_callback to find
    the current invocation_id, then retrieves the accumulated token counts from the
    callback state registry.

    Call this just before save_ghost_report_to_firestore to capture the full
    cost of the investigation session (all model turns combined).

    Returns:
        {
            "input_tokens": <int>,
            "output_tokens": <int>,
            "total_tokens": <int>,
            "cost_usd": <float>,
            "model_turns": <int>,
            "model": "<model-name>",
            "note": "Estimated from Vertex AI pricing table — actual billing may differ"
        }
    """
    inv_id = _get_current_invocation_id()

    if inv_id:
        try:
            from karma.otel_callbacks import get_invocation_cost
            data = get_invocation_cost(inv_id)
            data["note"] = "Estimated from Vertex AI pricing table — actual billing may differ"
            return data
        except Exception as exc:
            logger.debug("get_session_cost_estimate otel_callbacks error: %s", exc)

    # Fallback: return zeros with explanation
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "model_turns": 0,
        "model": "unknown",
        "note": "Cost tracking unavailable — OTel not configured or invocation_id not found",
    }


def _get_current_invocation_id() -> str | None:
    """Read karma.invocation_id from the active OTel span (set by before_tool_callback)."""
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span is None or not span.is_recording():
            return None
        attrs = getattr(span, "attributes", None)
        if attrs is None:
            return None
        val = attrs.get("karma.invocation_id")
        return str(val) if val else None
    except Exception:
        return None
