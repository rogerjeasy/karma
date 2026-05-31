"""Live demo control route — "Break v3 live".

Lets the dashboard flip the synthetic svc-payments-v3 service between its healthy
and regressed states at runtime, so a judge can watch Karma detect the regression
end to end instead of only reading a pre-baked ghost report.

The control secret stays server-side: the browser talks only to this API, which
forwards the toggle to svc-payments-v3 with the shared X-Karma-Control header.
Everything degrades gracefully — if SVC_PAYMENTS_V3_URL is unset the endpoints
report `configured: false` and the dashboard hides the button.
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException

from app import firestore_client
from app.auth import get_current_user
from app.config import settings
from app.models import V3ControlResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/control", tags=["demo"])

_TIMEOUT = 10.0


def _v3_url(path: str) -> str:
    return settings.svc_payments_v3_url.rstrip("/") + path


def _control_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.karma_control_token:
        headers["X-Karma-Control"] = settings.karma_control_token
    return headers


async def _set_v3_contract(healthy: bool) -> dict[str, Any]:
    if not settings.svc_payments_v3_url:
        raise HTTPException(
            status_code=503,
            detail="Live control not configured (set SVC_PAYMENTS_V3_URL on the API).",
        )
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _v3_url("/admin/contract"),
            json={"healthy": healthy},
            headers=_control_headers(),
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"svc-payments-v3 returned {resp.status_code}: {resp.text[:200]}",
        )
    data: dict[str, Any] = resp.json()
    return data


async def _get_v3_contract() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_v3_url("/admin/contract"), headers=_control_headers())
    resp.raise_for_status()
    data: dict[str, Any] = resp.json()
    return data


async def _kick_watchers() -> int:
    """Best-effort: run the Watcher now for every haunting service so the
    regression is detected within seconds instead of waiting for the 10-minute
    Cloud Scheduler tick. Reuses the same chain the scheduler uses."""
    try:
        services = await firestore_client.list_all_haunting_services()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("control_watcher_list_failed", error=str(exc))
        return 0
    if not services:
        return 0
    # _run_watcher_for_services drives the full Watcher → Forensic chain and is
    # the exact code path Cloud Scheduler triggers, so behavior stays identical.
    from app.routes.pubsub import _run_watcher_for_services

    asyncio.create_task(_run_watcher_for_services(services))
    return len(services)


@router.get("/v3-status", response_model=V3ControlResponse)
async def v3_status(
    _: dict[str, Any] = Depends(get_current_user),
) -> V3ControlResponse:
    """Report whether live control is wired up and v3's current contract state."""
    if not settings.svc_payments_v3_url:
        return V3ControlResponse(configured=False)
    try:
        data = await _get_v3_contract()
    except Exception as exc:
        logger.warning("control_v3_status_failed", error=str(exc))
        return V3ControlResponse(configured=True, reachable=False, message=str(exc)[:200])
    return V3ControlResponse(
        configured=True,
        reachable=True,
        healthy=bool(data.get("healthy")),
        writes_cache=bool(data.get("writes_cache")),
    )


@router.post("/break-v3", response_model=V3ControlResponse)
async def break_v3(
    trigger_watcher: bool = True,
    _: dict[str, Any] = Depends(get_current_user),
) -> V3ControlResponse:
    """Drop v3's cache-warming + 409 contract — the live regression begins now."""
    data = await _set_v3_contract(healthy=False)
    watcher_triggered = await _kick_watchers() if trigger_watcher else 0
    logger.info("v3_broken", watcher_triggered=watcher_triggered)
    return V3ControlResponse(
        configured=True,
        reachable=True,
        healthy=bool(data.get("healthy")),
        writes_cache=bool(data.get("writes_cache")),
        watcher_triggered=watcher_triggered,
        message="svc-payments-v3 is now regressed — Karma will detect the violation shortly.",
    )


@router.post("/heal-v3", response_model=V3ControlResponse)
async def heal_v3(
    _: dict[str, Any] = Depends(get_current_user),
) -> V3ControlResponse:
    """Restore v3 to healthy behavior (writes the cache key, returns original_txn_id)."""
    data = await _set_v3_contract(healthy=True)
    logger.info("v3_healed")
    return V3ControlResponse(
        configured=True,
        reachable=True,
        healthy=bool(data.get("healthy")),
        writes_cache=bool(data.get("writes_cache")),
        message="svc-payments-v3 restored to healthy behavior.",
    )
