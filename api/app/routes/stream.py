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

from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/stream", tags=["stream"])

# Active SSE queues — one per connected client.
# Each item is {"_event": str, "_data": dict} or None (sentinel to close).
_queues: list[asyncio.Queue[dict[str, Any] | None]] = []

# Event loop captured at startup — used for thread-safe dispatch from Firestore callbacks
_loop: asyncio.AbstractEventLoop | None = None


@router.get("/ghosts")
async def stream_ghosts(request: Request) -> EventSourceResponse:
    """SSE endpoint — clients connect and receive ghost reports and service updates."""
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    _queues.append(queue)
    logger.info("sse_client_connected", total_clients=len(_queues))

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
            if queue in _queues:
                _queues.remove(queue)
            logger.info("sse_client_disconnected", remaining=len(_queues))

    return EventSourceResponse(event_generator())


async def _broadcast(event: str, data: dict[str, Any]) -> None:
    """Push an event to every connected SSE client."""
    message: dict[str, Any] = {"_event": event, "_data": data}
    dead: list[asyncio.Queue[dict[str, Any] | None]] = []
    for queue in list(_queues):
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(queue)

    for queue in dead:
        if queue in _queues:
            _queues.remove(queue)

    logger.info("sse_broadcasted", event=event, clients=len(_queues), dropped=len(dead))


async def broadcast_ghost_report(report: dict[str, Any]) -> None:
    """Push a new ghost report to every connected SSE client."""
    await _broadcast("ghost_report", report)


async def broadcast_service_update(service: dict[str, Any]) -> None:
    """Push a service document change to every connected SSE client."""
    await _broadcast("service_update", service)


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
                if doc is not None:
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
