"""Dynatrace Notebook client — create executable notebooks via the MCP gateway.

Powers the contract page's "Verify in Dynatrace" button. Instead of dumping the
user on the generic getting-started notebook, Karma creates a real notebook whose
cells are the contract's DQL — so a judge clicks once and lands on a notebook that
runs against their own Grail data and returns real results.

This reuses the same MCP Streamable-HTTP / JSON-RPC transport as dt_copilot.py
(initialize → notifications/initialized → tools/call → delete session) and degrades
gracefully: every failure path returns None so the route can fall back to the
copy-the-DQL behaviour instead of erroring.

Endpoint:  settings.dt_mcp_endpoint
Auth:      Authorization: Bearer <DT_API_TOKEN>  (Platform Token)
Tool:      create-dynatrace-notebook  (content = ordered list of dql/markdown cells)
"""
from __future__ import annotations

import contextlib
import json
import re
from typing import Any

import httpx
import structlog

from app.config import settings

log = structlog.get_logger(__name__)

_TIMEOUT = 45.0
_PROTOCOL_VERSION = "2025-06-18"
_CLIENT_INFO = {"name": "karma-api", "version": "1.0"}
_CREATE_NOTEBOOK_TOOL = "create-dynatrace-notebook"

# The gateway returns a human string like "Document created successfully: https://…/notebook/<id>".
_URL_RE = re.compile(r"https://\S+/notebook/[0-9a-fA-F-]+")


async def create_notebook(
    name: str,
    content: list[dict[str, str]],
    description: str = "",
) -> str | None:
    """Create a Dynatrace Notebook and return its deep-link URL, or None on failure.

    Args:
        name: Notebook title shown in the Notebooks app.
        content: Ordered cells, each {"type": "dql"|"markdown", "text": "..."}.
        description: Optional notebook description (<=256 chars; truncated if longer).

    Never raises — returns None when Dynatrace is unconfigured, the gateway errors,
    or no notebook URL comes back, so callers can fall back gracefully.
    """
    if not settings.davis_copilot_enabled:  # same gate: requires dt_env + dt_api_token
        return None

    endpoint = settings.dt_mcp_endpoint
    headers = {
        "Authorization": f"Bearer {settings.dt_api_token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    arguments: dict[str, Any] = {"name": name, "content": content}
    if description:
        arguments["description"] = description[:256]

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
                    "params": {"name": _CREATE_NOTEBOOK_TOOL, "arguments": arguments},
                },
                headers=session_headers,
            )

            if session_id:
                with contextlib.suppress(Exception):
                    await client.request("DELETE", endpoint, headers=session_headers)

        if not resp.is_success:
            log.warning("dt_notebook_http_error", status=resp.status_code, body=resp.text[:200])
            return None

        payload = _parse_response(resp, request_id=1)
        return _extract_notebook_url(payload)
    except Exception as exc:  # noqa: BLE001 — degrade to fallback, never error the route
        log.warning("dt_notebook_failed", error=str(exc))
        return None


# ── Response parsing (mirrors dt_copilot._parse_response) ──────────────────────


def _parse_response(resp: httpx.Response, request_id: int) -> Any:
    content_type = resp.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        return _parse_sse(resp.text, request_id)
    rpc = resp.json()
    if "error" in rpc:
        log.warning("dt_notebook_rpc_error", error=rpc["error"])
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


def _extract_notebook_url(payload: Any) -> str | None:
    """Pull the notebook URL out of whatever shape the gateway returned."""
    if payload is None:
        return None
    if isinstance(payload, str):
        match = _URL_RE.search(payload)
        return match.group(0) if match else None
    if isinstance(payload, dict):
        for key in ("url", "notebookUrl", "documentUrl", "link"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                match = _URL_RE.search(val)
                return match.group(0) if match else val.strip()
        # Fall back to scanning the serialized dict for a notebook URL.
        match = _URL_RE.search(json.dumps(payload))
        return match.group(0) if match else None
    return None
