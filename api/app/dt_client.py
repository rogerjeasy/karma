"""Dynatrace Grail DQL client — query observability data from the Grail storage layer."""
from __future__ import annotations

import asyncio
import datetime as _dt
from datetime import datetime, timedelta
from typing import Any

import httpx
import structlog

from app.config import settings

log = structlog.get_logger(__name__)

_POLL_INTERVAL = 1.0
_MAX_POLLS = 12


async def query_grail(
    dql: str,
    days_back: int = 30,
) -> list[dict[str, Any]]:
    """Execute a DQL query against Dynatrace Grail and return the record rows.

    Returns an empty list when DT is not configured or the query fails —
    callers should treat an empty result as "data unavailable" rather than
    surfacing an error to the user.
    """
    if not settings.dt_env or not settings.dt_query_token:
        return []

    now = datetime.now(_dt.UTC)
    start = now - timedelta(days=days_back)
    iso_fmt = "%Y-%m-%dT%H:%M:%SZ"

    base = f"https://{settings.dt_env}.apps.dynatrace.com/platform/storage/query/v1"
    headers = {
        "Authorization": f"Api-Token {settings.dt_query_token}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "query": dql,
        "defaultTimeframeStart": start.strftime(iso_fmt),
        "defaultTimeframeEnd": now.strftime(iso_fmt),
        "requestTimeoutMilliseconds": 20_000,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(f"{base}/query:execute", json=body, headers=headers)
            if resp.status_code not in (200, 202):
                log.warning("dt_grail_query_failed", status=resp.status_code, body=resp.text[:200])
                return []

            data = resp.json()

            if data.get("state") == "SUCCEEDED":
                return _extract_records(data)

            request_token = data.get("requestToken")
            if not request_token:
                return []

            # Poll until complete
            poll_url = f"{base}/query:poll?requestToken={request_token}"
            for _ in range(_MAX_POLLS):
                await asyncio.sleep(_POLL_INTERVAL)
                pr = await client.get(poll_url, headers=headers)
                if pr.status_code != 200:
                    return []
                pd = pr.json()
                if pd.get("state") == "SUCCEEDED":
                    return _extract_records(pd)

            log.warning("dt_grail_query_timeout", request_token=request_token)
            return []

    except Exception as exc:
        log.warning("dt_grail_query_error", error=str(exc))
        return []


def _extract_records(data: dict[str, Any]) -> list[dict[str, Any]]:
    return data.get("result", {}).get("records", []) or []
