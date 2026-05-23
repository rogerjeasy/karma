"""Dynatrace MCP gateway tools — direct JSON-RPC over httpx.

The ADK McpToolset wrapper uses anyio cancel scopes that crash when
cleaned up across task boundaries in Agent Engine. These functions call
the same Dynatrace MCP gateway via the MCP Streamable HTTP protocol
(JSON-RPC over HTTP), bypassing the Python SDK wrapper while still routing
every request through the real Dynatrace MCP server and its AI agents.

Protocol: MCP Streamable HTTP (spec 2025-03-26)
Endpoint: settings.dt_mcp_endpoint
  → https://{dt_env}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp
Auth: Authorization: Bearer <DT_API_TOKEN>

OTel instrumentation: every _call_mcp_tool invocation emits a karma.mcp_tool_call
span with the tool name, session ID, duration, and success/error status.  When
called from within a gen_ai.tool.call span (set up by otel_callbacks), the MCP
span is automatically nested as a child of that tool span.
"""
from __future__ import annotations

import contextlib
import json
from typing import Any

import httpx
import structlog

from karma.config import settings
from karma.otel import SPAN_MCP_TOOL, get_tracer

logger = structlog.get_logger(__name__)

_TIMEOUT = 120.0
_MCP_CLIENT_INFO = {"name": "karma-agent", "version": "1.0"}
_PROTOCOL_VERSION = "2025-03-26"


# ── Internal JSON-RPC transport ───────────────────────────────────────────────


def _call_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call a Dynatrace MCP tool via the MCP Streamable HTTP protocol.

    Emits a karma.mcp_tool_call OTel span that nests under whatever tool span
    is currently active (set by otel_callbacks.before_tool_callback).

    Implements the full MCP session lifecycle:
    1. POST initialize → capture Mcp-Session-Id header
    2. POST notifications/initialized (required by spec)
    3. POST tools/call → parse JSON or SSE response
    4. DELETE session (best-effort cleanup)
    """
    tracer = get_tracer("karma.tools")

    with tracer.start_as_current_span(SPAN_MCP_TOOL) as span:
        span.set_attribute("gen_ai.tool.name", tool_name)
        span.set_attribute("karma.mcp.protocol", "streamable-http")
        span.set_attribute("karma.mcp.protocol_version", _PROTOCOL_VERSION)

        endpoint = settings.dt_mcp_endpoint
        if not endpoint:
            err = "DT_ENV not configured — cannot reach Dynatrace MCP gateway"
            span.set_attribute("karma.mcp.error", err)
            _set_span_error(span, err)
            return {"error": err}
        if not settings.dt_api_token:
            err = "DT_API_TOKEN not configured"
            span.set_attribute("karma.mcp.error", err)
            _set_span_error(span, err)
            return {"error": err}

        base_headers: dict[str, str] = {
            "Authorization": f"Bearer {settings.dt_api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                # 1. Initialize
                init_resp = client.post(
                    endpoint,
                    json={
                        "jsonrpc": "2.0",
                        "id": 0,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": _PROTOCOL_VERSION,
                            "capabilities": {},
                            "clientInfo": _MCP_CLIENT_INFO,
                        },
                    },
                    headers=base_headers,
                )

                session_headers = dict(base_headers)
                session_id = init_resp.headers.get("Mcp-Session-Id")
                if session_id:
                    session_headers["Mcp-Session-Id"] = session_id
                    span.set_attribute("karma.mcp.session_id", session_id)

                # 2. Send initialized notification (no response expected)
                client.post(
                    endpoint,
                    json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                    headers=session_headers,
                )

                # 3. Call the tool
                call_id = 1
                tool_resp = client.post(
                    endpoint,
                    json={
                        "jsonrpc": "2.0",
                        "id": call_id,
                        "method": "tools/call",
                        "params": {"name": tool_name, "arguments": arguments},
                    },
                    headers=session_headers,
                )

                span.set_attribute("karma.mcp.http_status", tool_resp.status_code)

                # 4. Terminate session (best effort)
                if session_id:
                    with contextlib.suppress(Exception):
                        client.request("DELETE", endpoint, headers=session_headers)

            if not tool_resp.is_success:
                logger.warning(
                    "mcp_tool_http_error",
                    tool=tool_name,
                    status=tool_resp.status_code,
                )
                err = f"MCP tool call failed: HTTP {tool_resp.status_code}"
                span.set_attribute("karma.mcp.error", err)
                _set_span_error(span, err)
                return {"error": err, "detail": tool_resp.text[:500]}

            content_type = tool_resp.headers.get("content-type", "")
            if "text/event-stream" in content_type:
                result = _parse_sse_response(tool_resp.text, call_id)
            else:
                rpc_resp: dict[str, Any] = tool_resp.json()
                if "error" in rpc_resp:
                    err_payload = rpc_resp["error"]
                    err_msg = (
                        err_payload.get("message", str(err_payload))
                        if isinstance(err_payload, dict)
                        else str(err_payload)
                    )
                    span.set_attribute("karma.mcp.error", err_msg)
                    _set_span_error(span, err_msg)
                    return {"error": err_msg}
                result = _extract_mcp_content(rpc_resp.get("result", {}))

            # Mark success
            _set_span_ok(span)
            return result

        except Exception as exc:
            logger.error("mcp_tool_exception", tool=tool_name, error=str(exc))
            span.set_attribute("karma.mcp.error", str(exc)[:300])
            _set_span_error(span, str(exc))
            with contextlib.suppress(Exception):
                span.record_exception(exc)
            return {"error": str(exc)}


def _set_span_ok(span: Any) -> None:
    try:
        from opentelemetry.trace import Status, StatusCode
        span.set_status(Status(StatusCode.OK))
    except ImportError:
        pass


def _set_span_error(span: Any, message: str) -> None:
    try:
        from opentelemetry.trace import Status, StatusCode
        span.set_status(Status(StatusCode.ERROR, message))
    except ImportError:
        pass


def _parse_sse_response(sse_text: str, request_id: int) -> dict[str, Any]:
    """Extract the JSON-RPC result for request_id from an SSE response body."""
    for line in sse_text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            payload: dict[str, Any] = json.loads(line[6:])
            if payload.get("id") == request_id:
                if "error" in payload:
                    err = payload["error"]
                    return {"error": err.get("message", str(err)) if isinstance(err, dict) else str(err)}
                return _extract_mcp_content(payload.get("result", {}))
        except (json.JSONDecodeError, AttributeError):
            continue
    return {"error": "No matching response in SSE stream", "raw": sse_text[:500]}


def _extract_mcp_content(result: dict[str, Any]) -> dict[str, Any]:
    """Flatten MCP tool result content into a dict."""
    content = result.get("content", [])
    if not content:
        return result

    texts = [
        item.get("text", "")
        for item in content
        if isinstance(item, dict) and item.get("type") == "text"
    ]
    if not texts:
        return result

    combined = "\n".join(texts)
    try:
        return {"result": json.loads(combined)}
    except json.JSONDecodeError:
        return {"result": combined}


# ── Public agent-callable tools ───────────────────────────────────────────────


def query_problems_via_mcp(service_id: str, window_minutes: int = 60) -> dict[str, Any]:
    """Query active Davis AI problems for a service via the Dynatrace MCP Root Cause Agent.

    Use this alongside execute_dql to get AI-enriched problem context from Davis.
    The MCP Root Cause Agent performs causal analysis beyond what raw DQL returns.

    Args:
        service_id: Dynatrace entity ID (e.g. "SERVICE-XXXXXXXXXXXXXXXX")
        window_minutes: Look-back window in minutes (default 60)

    Returns:
        Dict with Davis problem summaries and root-cause analysis.
    """
    logger.info("mcp_query_problems", service_id=service_id, window_minutes=window_minutes)
    return _call_mcp_tool(
        "query-problems",
        {
            "generalParameters": {
                "timeframe": {
                    "startTime": f"now-{window_minutes}m",
                    "endTime": "now",
                }
            },
            "entitySelector": f'entityId("{service_id}")',
        },
    )


def get_entity_id_via_mcp(entity_name: str, entity_type: str = "SERVICE") -> dict[str, Any]:
    """Resolve a service name to a Dynatrace entity ID via the MCP Smartscape Agent.

    Use this to translate a human-readable service name into the entity ID
    required by DQL queries. Prefer this over a manual DQL lookup when you
    only have the service name.

    Args:
        entity_name: Human-readable name (e.g. "svc-payments-v2")
        entity_type: Entity type — "SERVICE", "HOST", "PROCESS_GROUP" (default "SERVICE")

    Returns:
        Dict with entity.id and entity.name fields.
    """
    logger.info("mcp_get_entity_id", entity_name=entity_name, entity_type=entity_type)
    return _call_mcp_tool(
        "get-entity-id",
        {"entityName": entity_name, "entityType": entity_type},
    )


def get_entity_name_via_mcp(entity_id: str) -> dict[str, Any]:
    """Resolve a Dynatrace entity ID to its human-readable name via the MCP Smartscape Agent.

    Use this to translate raw entity IDs in DQL results into readable service names
    for the ghost report's downstream_impact and evidence_links fields.

    Args:
        entity_id: Dynatrace entity ID (e.g. "SERVICE-XXXXXXXXXXXXXXXX")

    Returns:
        Dict with the entity name string.
    """
    logger.info("mcp_get_entity_name", entity_id=entity_id)
    return _call_mcp_tool("get-entity-name", {"entityId": entity_id})


def get_problem_details_via_mcp(problem_id: str) -> dict[str, Any]:
    """Get full Davis AI problem details via the MCP Root Cause Details Agent.

    Use this after query_problems_via_mcp to get the complete root cause
    analysis, affected entities, and timeline for a specific Davis problem.

    Args:
        problem_id: Davis problem ID returned by query_problems_via_mcp

    Returns:
        Dict with full problem details, affected entities, and root cause.
    """
    logger.info("mcp_get_problem_details", problem_id=problem_id)
    return _call_mcp_tool("get-problem-by-id", {"problemId": problem_id})


def detect_changepoints_via_mcp(
    dql_query: str,
    start_time: str = "now-2h",
    end_time: str = "now",
) -> dict[str, Any]:
    """Detect behavioral changepoints in a metric timeseries via the MCP Changepoint Agent.

    Identifies statistically significant shifts in metric behavior. Use this
    during forensic investigation to determine *when* a contract violation began,
    or during learning to identify unusual behavioral windows worth capturing.

    Args:
        dql_query: DQL timeseries query to analyze
                   (e.g. 'timeseries p95=percentile(duration,95), by:{dt.entity.service}')
        start_time: Analysis window start — ISO 8601 or relative like "now-4h" (default "now-2h")
        end_time: Analysis window end (default "now")

    Returns:
        Dict with changepoint timestamps and novelty scores.
    """
    logger.info("mcp_detect_changepoints", start=start_time, end=end_time)
    return _call_mcp_tool(
        "timeseries-novelty-detection",
        {
            "generalParameters": {
                "timeframe": {"startTime": start_time, "endTime": end_time}
            },
            "timeSeriesData": dql_query,
        },
    )


def ask_dynatrace_docs_via_mcp(
    question: str,
    context: str = "",
) -> dict[str, Any]:
    """Ask the Dynatrace documentation AI agent for troubleshooting guidance.

    Queries the Dynatrace MCP ask-dynatrace-docs tool, which uses Davis AI to
    answer questions about Dynatrace features, DQL syntax, and remediation
    best practices.  Use this during forensic investigation to get AI-powered
    recommendations specific to the violation category.

    Args:
        question: Natural language question about the violation or remediation.
                  Example: "How do I detect Redis cache misses in Dynatrace spans?"
        context: Optional context about the violation to narrow the answer.
                 Example: "side_effect contract violation on svc-payments-v3"

    Returns:
        Dict with documentation answer and relevant references.
    """
    logger.info("mcp_ask_dynatrace_docs", question=question[:80])
    query = f"{question}\n\nContext: {context}" if context else question
    return _call_mcp_tool("ask-dynatrace-docs", {"question": query})


def find_troubleshooting_guides_via_mcp(
    topic: str,
) -> dict[str, Any]:
    """Find Dynatrace troubleshooting guides relevant to a violation type.

    Searches the Dynatrace knowledge base for guides that match the violation topic.
    Returns links and summaries of the most relevant guides for the forensic report.

    Args:
        topic: The problem topic to search for.
               Example: "Redis connection pool exhaustion" or "HTTP 409 response changes"

    Returns:
        Dict with matching guide titles, summaries, and Dynatrace documentation links.
    """
    logger.info("mcp_find_troubleshooting_guides", topic=topic[:80])
    return _call_mcp_tool("find-troubleshooting-guides", {"query": topic})


def adaptive_anomaly_detection_via_mcp(
    dql_query: str,
    start_time: str = "now-2h",
    end_time: str = "now",
    alert_condition: str = "ABOVE",
) -> dict[str, Any]:
    """Detect anomalies in a metric timeseries via the MCP Autoadaptive Threshold Agent.

    Learns the normal range from the data distribution and flags deviations.
    Use during learning to identify statistically unusual behaviors that warrant
    capture as contracts — especially for resource and throughput categories.

    Args:
        dql_query: DQL timeseries query to analyze
        start_time: Analysis window start (default "now-2h")
        end_time: Analysis window end (default "now")
        alert_condition: "ABOVE", "BELOW", or "OUTSIDE" (default "ABOVE")

    Returns:
        Dict with anomaly detection results and adaptive threshold bounds.
    """
    logger.info("mcp_adaptive_anomaly", start=start_time, end=end_time)
    return _call_mcp_tool(
        "adaptive-anomaly-detector",
        {
            "generalParameters": {
                "timeframe": {"startTime": start_time, "endTime": end_time}
            },
            "timeSeriesData": dql_query,
            "numberOfSignalFluctuations": 1.0,
            "alertCondition": alert_condition,
            "violatingSamples": 3,
            "slidingWindow": 5,
            "dealertingSamples": 5,
            "alertOnMissingData": False,
        },
    )
