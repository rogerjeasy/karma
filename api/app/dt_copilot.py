"""Davis CoPilot client — natural-language → DQL via the Dynatrace MCP gateway.

Powers the global "Ask Karma" console. A user's plain-English question is sent to
Davis CoPilot (Dynatrace's own AI) through the hosted MCP gateway, which returns a
real DQL query. The API then executes that query against Grail (dt_client) and lets
Gemini explain the rows — so the answer is grounded in real telemetry, and the exact
DQL Davis generated is surfaced to the user (great for verification and demos).

This mirrors the agents' karma/tools/mcp_gateway_tools transport (MCP Streamable
HTTP, JSON-RPC), but lives in the API and is fully async + degrades gracefully:
every failure path returns None so the console can fall back to a contracts-grounded
answer instead of erroring.

Endpoint:  settings.dt_mcp_endpoint
Auth:      Authorization: Bearer <DT_API_TOKEN>  (Platform Token)
Disabled when settings.davis_copilot_enabled is False (no env / no token).
"""
from __future__ import annotations

import contextlib
import json
from typing import Any

import httpx
import structlog

from app.config import settings

log = structlog.get_logger(__name__)

_TIMEOUT = 45.0
_PROTOCOL_VERSION = "2025-06-18"
_CLIENT_INFO = {"name": "karma-api", "version": "1.0"}

# Read-only DQL verbs Davis CoPilot is expected to produce. We refuse to execute
# anything else as defence-in-depth before handing a generated query to Grail.
_SAFE_DQL_PREFIXES = ("fetch", "timeseries", "data", "describe")


async def nl_to_dql(question: str) -> str | None:
    """Translate a natural-language question into DQL via Davis CoPilot.

    Returns the generated DQL string, or None when Davis CoPilot is unconfigured,
    the gateway errors, or no usable query comes back. Never raises.
    """
    if not settings.davis_copilot_enabled:
        return None

    endpoint = settings.dt_mcp_endpoint
    headers = {
        "Authorization": f"Bearer {settings.dt_api_token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    # The gateway tool accepts the user text; we pass it under several common keys so
    # a minor schema difference doesn't silently drop the question.
    arguments = {"text": question, "naturalLanguage": question, "query": question}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            init = await client.post(
                endpoint,
                json={
                    "jsonrpc": "2.0",
                    "id": 0,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": _PROTOCOL_VERSION,
                        "capabilities": {},
                        "clientInfo": _CLIENT_INFO,
                    },
                },
                headers=headers,
            )
            session_headers = dict(headers)
            session_id = init.headers.get("Mcp-Session-Id")
            if session_id:
                session_headers["Mcp-Session-Id"] = session_id

            await client.post(
                endpoint,
                json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                headers=session_headers,
            )

            resp = await client.post(
                endpoint,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {
                        "name": settings.dt_copilot_nl2dql_tool,
                        "arguments": arguments,
                    },
                },
                headers=session_headers,
            )

            if session_id:
                # Session cleanup is best-effort — ignore any failure.
                with contextlib.suppress(Exception):
                    await client.request("DELETE", endpoint, headers=session_headers)

        if not resp.is_success:
            log.warning("davis_copilot_http_error", status=resp.status_code, body=resp.text[:200])
            return None

        payload = _parse_response(resp, request_id=1)
        return _extract_dql(payload)
    except Exception as exc:  # noqa: BLE001 — degrade to fallback, never error the route
        log.warning("davis_copilot_failed", error=str(exc))
        return None


def is_safe_read_dql(dql: str) -> bool:
    """True if the DQL is a read-only query we're willing to execute on Grail."""
    head = dql.strip().lstrip("|").strip().lower()
    return head.startswith(_SAFE_DQL_PREFIXES)


# ── Response parsing (mirrors agents' _extract_mcp_content / _parse_sse_response) ──


def _parse_response(resp: httpx.Response, request_id: int) -> Any:
    content_type = resp.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        return _parse_sse(resp.text, request_id)
    rpc = resp.json()
    if "error" in rpc:
        log.warning("davis_copilot_rpc_error", error=rpc["error"])
        return None
    return _flatten_content(rpc.get("result", {}))


def _parse_sse(sse_text: str, request_id: int) -> Any:
    for line in sse_text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            payload = json.loads(line[6:])
        except (json.JSONDecodeError, AttributeError):
            continue
        if payload.get("id") == request_id:
            if "error" in payload:
                return None
            return _flatten_content(payload.get("result", {}))
    return None


def _flatten_content(result: dict[str, Any]) -> Any:
    """Collapse an MCP tool result's content blocks into a dict or string."""
    content = result.get("content", [])
    texts = [
        item.get("text", "")
        for item in content
        if isinstance(item, dict) and item.get("type") == "text"
    ]
    if not texts:
        return result
    combined = "\n".join(t for t in texts if t)
    try:
        return json.loads(combined)
    except json.JSONDecodeError:
        return combined


def _extract_dql(payload: Any) -> str | None:
    """Pull a DQL string out of whatever shape Davis CoPilot returned."""
    if payload is None:
        return None
    if isinstance(payload, str):
        dql = payload.strip()
        return dql or None
    if isinstance(payload, dict):
        for key in ("dql", "query", "result", "text", "answer"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
    return None
