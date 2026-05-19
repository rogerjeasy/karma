"""Server-Sent Events (SSE) route — pushes ghost reports to the dashboard in real time.

The dashboard subscribes to /stream and receives events as they are written
to Firestore. Uses Firestore's on_snapshot listener bridged to SSE via an
asyncio.Queue.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import json
from collections.abc import AsyncGenerator
from datetime import datetime

import structlog
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.firestore_client import get_db

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/stream", tags=["stream"])

# Active SSE queues — one per connected client
_queues: list[asyncio.Queue[dict | None]] = []


@router.get("/ghosts")
async def stream_ghosts(request: Request) -> EventSourceResponse:
    """SSE endpoint. Clients connect and receive ghost reports as they arrive."""
    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    _queues.append(queue)
    logger.info("sse_client_connected", total_clients=len(_queues))

    async def event_generator() -> AsyncGenerator[dict, None]:
        # Send a heartbeat immediately so the client knows the connection is live
        yield {"event": "ping", "data": json.dumps({"ts": datetime.now(dt.UTC).isoformat()})}

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=25.0)
                except TimeoutError:
                    # Send a keepalive comment every 25s so proxies don't drop the connection
                    yield {"event": "ping", "data": "{}"}
                    continue

                if message is None:
                    break

                yield {"event": "ghost_report", "data": json.dumps(message, default=str)}
        finally:
            _queues.remove(queue)
            logger.info("sse_client_disconnected", remaining=len(_queues))

    return EventSourceResponse(event_generator())


async def broadcast_ghost_report(report: dict) -> None:
    """Called by the ghost report handler when a new report is saved.

    Pushes the report to all connected SSE clients.
    """
    for queue in list(_queues):
        await queue.put(report)
    logger.info("ghost_report_broadcasted", clients=len(_queues))


def start_firestore_listener() -> None:
    """Attach a Firestore on_snapshot listener to push new ghost reports to SSE queues.

    Called once at application startup.
    """
    db = get_db()
    loop = asyncio.get_event_loop()

    def on_snapshot(col_snapshot: object, changes: object, read_time: object) -> None:
        for change in changes:  # type: ignore[attr-defined]
            if change.type.name == "ADDED":
                doc = change.document.to_dict()
                loop.call_soon_threadsafe(
                    lambda d=doc: asyncio.ensure_future(broadcast_ghost_report(d))
                )

    db.collection("ghost_reports").on_snapshot(on_snapshot)
    logger.info("firestore_sse_listener_started")
