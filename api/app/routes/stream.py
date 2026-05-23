"""Server-Sent Events (SSE) route — pushes real-time updates to the dashboard.

The dashboard subscribes to /stream/ghosts and receives two event types:
  - ghost_report   — new violation report written to ghost_reports collection
  - service_update — service document modified (e.g. phase: learning → ready)

Uses Firestore's on_snapshot listener (sync client) bridged to SSE via
asyncio.run_coroutine_threadsafe — the correct pattern for thread → asyncio dispatch.

Note: on_snapshot is only supported on the sync Firestore client, not AsyncClient.
A dedicated sync client is created here so the async API client stays unaffected.

Queue message format: {"_event": str, "_data": dict}
"""
from __future__ import annotations

import asyncio
import datetime as dt
import json
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Request
from google.cloud import firestore as gcp_firestore
from sse_starlette.sse import EventSourceResponse

from app.auth import get_firebase_app
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/stream", tags=["stream"])

# Per-user SSE queues: user_id → list of active queues for that user.
# Each item in the inner list is {"_event": str, "_data": dict} or None (sentinel).
_user_queues: dict[str, list[asyncio.Queue[dict[str, Any] | None]]] = {}

# Event loop captured at startup — used for thread-safe dispatch from Firestore callbacks
_loop: asyncio.AbstractEventLoop | None = None


@router.get("/ghosts")
async def stream_ghosts(request: Request) -> EventSourceResponse:
    """SSE endpoint — authenticated clients receive events scoped to their own data."""
    # Resolve user_id from the Authorization header; fall back to empty string.
    user_id = ""
    try:
        from firebase_admin import auth as firebase_auth
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            decoded = firebase_auth.verify_id_token(
                token, app=get_firebase_app(), check_revoked=False
            )
            user_id = decoded.get("uid", "")
    except Exception:
        pass

    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    _user_queues.setdefault(user_id, []).append(queue)
    logger.info("sse_client_connected", user_id=user_id, total_users=len(_user_queues))

    async def event_generator() -> AsyncGenerator[dict[str, Any], None]:
        # Immediate ping so the client knows the connection is live
        yield {"event": "ping", "data": json.dumps({"ts": datetime.now(dt.UTC).isoformat()})}

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=25.0)
                except TimeoutError:
                    # Keepalive every 25 s — proxies drop silent connections
                    yield {"event": "ping", "data": "{}"}
                    continue

                if message is None:
                    break

                yield {
                    "event": message["_event"],
                    "data": json.dumps(message["_data"], default=str),
                }
        finally:
            user_qs = _user_queues.get(user_id, [])
            if queue in user_qs:
                user_qs.remove(queue)
            if not user_qs:
                _user_queues.pop(user_id, None)
            logger.info(
                "sse_client_disconnected",
                user_id=user_id,
                remaining_users=len(_user_queues),
            )

    return EventSourceResponse(event_generator())


async def _broadcast_to_user(user_id: str, event: str, data: dict[str, Any]) -> None:
    """Push an event only to queues belonging to the given user_id."""
    message: dict[str, Any] = {"_event": event, "_data": data}
    user_qs = list(_user_queues.get(user_id, []))
    dead: list[asyncio.Queue[dict[str, Any] | None]] = []
    for queue in user_qs:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(queue)

    active_qs = _user_queues.get(user_id, [])
    for queue in dead:
        if queue in active_qs:
            active_qs.remove(queue)

    if user_qs:
        logger.info(
            "sse_broadcasted",
            event=event,
            user_id=user_id,
            clients=len(user_qs),
            dropped=len(dead),
        )


async def broadcast_ghost_report(report: dict[str, Any]) -> None:
    """Push a new ghost report only to the owning user's SSE clients."""
    user_id = report.get("user_id", "")
    if user_id:
        await _broadcast_to_user(user_id, "ghost_report", report)
    else:
        # Fallback for legacy reports without user_id: broadcast to all.
        for uid in list(_user_queues.keys()):
            await _broadcast_to_user(uid, "ghost_report", report)


async def broadcast_service_update(service: dict[str, Any]) -> None:
    """Push a service document change only to the owning user's SSE clients."""
    user_id = service.get("user_id", "")
    if user_id:
        await _broadcast_to_user(user_id, "service_update", service)
    else:
        for uid in list(_user_queues.keys()):
            await _broadcast_to_user(uid, "service_update", service)


def start_firestore_listener() -> None:
    """Attach Firestore on_snapshot listeners for ghost_reports and services.

    Must be called from within an async context (e.g. FastAPI lifespan) so that
    asyncio.get_running_loop() succeeds. Internally uses the sync Firestore client
    because on_snapshot is not available on AsyncClient.
    """
    global _loop
    try:
        _loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning("no_running_event_loop_for_sse_listener")
        return

    try:
        db_sync = gcp_firestore.Client(
            project=settings.gcp_project_id,
            database=settings.firestore_database,
        )
    except Exception as exc:
        logger.warning("sync_firestore_client_init_failed", error=str(exc))
        return

    captured_loop = _loop

    def on_ghost_snapshot(col_snapshot: object, changes: object, read_time: object) -> None:
        for change in changes:  # type: ignore[attr-defined]
            if change.type.name == "ADDED":
                doc: dict[str, Any] | None = change.document.to_dict()
                if doc is None:
                    continue

                # Inject user_id if the agent did not set it (no agent redeploy needed).
                if not doc.get("user_id"):
                    karma_service_id = doc.get("karma_service_id", "")
                    if karma_service_id:
                        try:
                            svc_doc = (
                                db_sync.collection("services")
                                .document(karma_service_id)
                                .get()
                            )
                            svc_exists: bool = svc_doc.exists  # type: ignore[union-attr]
                            svc_data = (
                                svc_doc.to_dict()  # type: ignore[union-attr]
                                if svc_exists
                                else None
                            )
                            user_id = (svc_data or {}).get("user_id", "")
                            if user_id:
                                doc = {**doc, "user_id": user_id}
                                # Persist so future API queries can filter by user_id.
                                change.document.reference.update({"user_id": user_id})
                        except Exception:
                            pass

                asyncio.run_coroutine_threadsafe(
                    broadcast_ghost_report(doc), captured_loop
                )

    def on_service_snapshot(col_snapshot: object, changes: object, read_time: object) -> None:
        for change in changes:  # type: ignore[attr-defined]
            # MODIFIED covers phase transitions (learning→ready, ready→haunting, etc.)
            # ADDED covers the initial write so a newly opened tab sees the correct phase.
            if change.type.name in ("MODIFIED", "ADDED"):
                doc = change.document.to_dict()
                if doc is not None:
                    asyncio.run_coroutine_threadsafe(
                        broadcast_service_update(doc), captured_loop
                    )

    db_sync.collection("ghost_reports").on_snapshot(on_ghost_snapshot)
    db_sync.collection("services").on_snapshot(on_service_snapshot)
    logger.info("firestore_sse_listeners_started")
