"""Direct Dynatrace API tools — replaces McpToolset for Agent Engine.

McpToolset with StreamableHTTPConnectionParams uses anyio cancel scopes that
cannot be cleaned up across task boundaries in Agent Engine's async runtime,
causing "Attempted to exit cancel scope in a different task" on every call.

These are plain synchronous httpx functions with no anyio dependency. They
work correctly in any async context because the httpx.Client runs in the
calling thread without creating anyio tasks.
"""
from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

from karma.config import settings

logger = structlog.get_logger(__name__)

_TIMEOUT = 120.0  # seconds for initial DQL submit
_POLL_TIMEOUT = 30.0  # seconds per poll request
_MAX_POLLS = 20  # 20 × 3s = 60s max wait


def execute_dql(query: str) -> dict[str, Any]:
    """Execute a DQL query against Dynatrace Grail and return results.

    This is the primary Dynatrace analysis tool. Use it to query spans, logs,
    metrics, timeseries, entities, events, and problems — everything the
    Dynatrace platform stores.

    Args:
        query: A valid DQL statement. Examples:

            Span latency percentiles:
              timeseries p50=percentile(duration,50), p95=percentile(duration,95)
              , from:now()-14d, by:{dt.entity.service}
              | filter dt.entity.service == "SERVICE-XXX"

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
    if not settings.dt_env or not settings.dt_api_token:
        return {
            "error": (
                "Dynatrace not configured — DT_ENV or DT_API_TOKEN missing. "
                "Set these environment variables and redeploy the agent."
            )
        }

    url = f"{settings.dt_base_url}/platform/storage/query/v1/query:execute"
    headers = {
        "Authorization": f"Bearer {settings.dt_api_token}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "query": query,
        "requestTimeoutMilliseconds": int(_TIMEOUT * 1000),
        "maxResultRecords": 1000,
        "fetchTimeoutSeconds": int(_TIMEOUT),
    }

    try:
        with httpx.Client(timeout=_TIMEOUT + 10) as client:
            resp = client.post(url, json=body, headers=headers)

        if not resp.is_success:
            logger.warning(
                "execute_dql_http_error",
                status=resp.status_code,
                query_prefix=query[:80],
            )
            return {
                "error": f"DQL request failed: HTTP {resp.status_code}",
                "detail": resp.text[:500],
            }

        data: dict[str, Any] = resp.json()
        state = data.get("state")

        # Grail returns results immediately when they're ready.
        # For longer queries it returns RUNNING + requestToken — poll for results.
        if state == "SUCCEEDED" or "result" in data:
            return data

        token = data.get("requestToken")
        if token:
            return _poll_dql(token, headers)

        # Unexpected response format — return as-is
        return data

    except Exception as exc:
        logger.error("execute_dql_exception", error=str(exc), query_prefix=query[:80])
        return {"error": str(exc)}


def _poll_dql(token: str, headers: dict[str, Any]) -> dict[str, Any]:
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
                return data
            if state == "FAILED":
                return {"error": "DQL query failed server-side", "detail": str(data)}

            # RUNNING — wait and retry
            time.sleep(3)

        except Exception as exc:
            return {"error": f"Poll exception: {exc}"}

    return {
        "error": f"DQL query timed out after {_MAX_POLLS * 3}s",
        "requestToken": token,
    }
