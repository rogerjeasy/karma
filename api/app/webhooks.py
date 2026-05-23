"""Fire-and-forget webhook dispatch for key Karma events."""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)


async def notify_ghost_report(data: dict[str, Any]) -> None:
    """POST a ghost-report notification to settings.webhook_url if configured."""
    if not settings.webhook_url:
        return
    contract = data.get("contract") or {}
    payload: dict[str, Any] = {
        "event": "ghost_report",
        "report_id": data.get("report_id", ""),
        "severity": data.get("severity", "medium"),
        "summary": data.get("summary", ""),
        "karma_service_id": data.get("karma_service_id", ""),
        "category": contract.get("category", ""),
        "created_at": str(data.get("created_at", "")),
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(settings.webhook_url, json=payload)
        logger.info("webhook_delivered", report_id=payload["report_id"], status=resp.status_code)
    except Exception as exc:
        logger.warning("webhook_failed", report_id=payload["report_id"], error=str(exc))
