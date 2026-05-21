"""Pub/Sub push subscription endpoints.

Two subscriptions handled here:

  POST /internal/watcher-tick
    Triggered by Cloud Scheduler every 10 minutes via a Pub/Sub push
    subscription. Runs the Watcher → Forensic chain for every service
    currently in 'haunting' phase across all users.

  POST /internal/violation-received
    Triggered when the Watcher agent publishes a violation to the
    karma-violations topic. Triggers the Forensic agent for that
    violation asynchronously.

Cloud Run Pub/Sub push message shape:
  {
    "message": {
      "data": "<base64-encoded JSON payload>",
      "messageId": "...",
      "attributes": { "karma_service_id": "...", ... }
    },
    "subscription": "projects/.../subscriptions/..."
  }

Authentication: Cloud Run validates the OIDC token attached to Pub/Sub push
messages automatically via IAM — no explicit auth check is needed here.
Both endpoints return 204 quickly; actual agent work runs in background tasks.
"""
from __future__ import annotations

import asyncio
import base64
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Request, Response

from app import agent_client, firestore_client

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/internal", tags=["internal"])


# ── Pub/Sub message decoder ───────────────────────────────────────────────────

def _decode_pubsub_body(body: dict[str, Any]) -> dict[str, Any] | None:
    """Decode the base64 data field from a Pub/Sub push message body."""
    try:
        data_b64: str = body["message"]["data"]
        decoded: dict[str, Any] = json.loads(base64.b64decode(data_b64).decode("utf-8"))
        return decoded
    except Exception as exc:
        logger.warning("pubsub_decode_failed", error=str(exc))
        return None


# ── Cloud Scheduler tick ──────────────────────────────────────────────────────

@router.post("/watcher-tick", status_code=204)
async def watcher_tick(request: Request) -> Response:
    """Cloud Scheduler → Pub/Sub push endpoint.

    Runs every 10 minutes. Fetches all services in haunting phase (across all
    users) and triggers the Watcher → Forensic chain for each.

    Returns 204 immediately so Pub/Sub does not retry; work runs in a background task.
    """
    haunting = await firestore_client.list_all_haunting_services()
    if haunting:
        logger.info("watcher_tick_received", services=len(haunting))
        asyncio.create_task(_run_watcher_for_services(haunting))
    return Response(status_code=204)


async def _run_watcher_for_services(services: list[dict[str, Any]]) -> None:
    from app.config import settings

    for svc in services:
        karma_service_id = svc["service_id"]
        log = logger.bind(karma_service_id=karma_service_id)

        contracts = await firestore_client.list_contracts_for_service(karma_service_id)
        if not contracts:
            log.info("watcher_skipped_no_contracts")
            continue

        log.info("watcher_scheduled_run", contract_count=len(contracts))
        watcher_result = await agent_client.trigger_watcher(
            old_service_id=svc["dynatrace_entity_id"],
            new_service_id=svc.get("replacement_service_id", ""),
            contracts=contracts,
            karma_service_id=karma_service_id,
        )

        # Violations published to Pub/Sub by the agent's publish_violation_to_pubsub
        # tool will arrive at /internal/violation-received, which resets the counter.
        # As a fallback, also process any violations returned in the agent's JSON output
        # (handles cases where Pub/Sub publish failed inside the agent).
        violations = _extract_violations(watcher_result)

        if violations:
            await firestore_client.reset_clean_watcher_runs(karma_service_id)
        else:
            threshold = settings.watcher_clean_runs_to_complete
            should_complete = await firestore_client.record_clean_watcher_run(
                karma_service_id, threshold
            )
            if should_complete:
                await firestore_client.update_service_phase(
                    karma_service_id, "completed", extra={"clean_watcher_runs": 0}
                )
                log.info("auto_completed_clean_runs", threshold=threshold)
                continue

        for v in violations:
            if not v.get("needs_forensic") or v.get("published_to_pubsub"):
                continue
            contract = next(
                (c for c in contracts if c.get("contract_id") == v.get("contract_id")), None
            )
            if contract is None:
                continue
            log.info("forensic_fallback_trigger", violation_id=v.get("violation_id"))
            await agent_client.trigger_forensic(
                violation_id=v.get("violation_id") or str(uuid.uuid4()),
                contract=contract,
                new_service_id=svc.get("replacement_service_id", ""),
                violation_window=_violation_window(),
                karma_service_id=karma_service_id,
            )


# ── Violation subscriber — triggers Forensic from Pub/Sub ────────────────────

@router.post("/violation-received", status_code=204)
async def violation_received(request: Request) -> Response:
    """Pub/Sub push endpoint for the karma-violations topic.

    Published by the Watcher agent's publish_violation_to_pubsub tool.
    Decodes the violation payload, fetches the contract from Firestore, and
    triggers the Forensic agent asynchronously.

    Always returns 204 to ack the message (even on partial failure) to prevent
    infinite Pub/Sub redelivery loops.
    """
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=204)

    payload = _decode_pubsub_body(body)
    if payload is None:
        return Response(status_code=204)

    karma_service_id = payload.get("karma_service_id", "")
    contract_id = payload.get("contract_id", "")
    new_service_id = payload.get("new_service_id", "")
    contract = payload.get("contract")  # watcher embeds the full contract

    if not all([karma_service_id, contract_id, new_service_id]):
        logger.warning("violation_message_incomplete", keys=list(payload.keys()))
        return Response(status_code=204)

    if contract is None:
        # Fall back to fetching from Firestore if the agent omitted the contract object.
        contracts = await firestore_client.list_contracts_for_service(karma_service_id)
        contract = next((c for c in contracts if c.get("contract_id") == contract_id), None)

    if contract is None:
        logger.warning("violation_contract_not_found", contract_id=contract_id)
        return Response(status_code=204)

    # A violation arrived — invalidate any accumulated clean-run streak.
    await firestore_client.reset_clean_watcher_runs(karma_service_id)

    asyncio.create_task(
        agent_client.trigger_forensic(
            violation_id=payload.get("violation_id") or str(uuid.uuid4()),
            contract=contract,
            new_service_id=new_service_id,
            violation_window=_violation_window(),
            karma_service_id=karma_service_id,
        )
    )
    logger.info(
        "forensic_triggered_from_pubsub",
        contract_id=contract_id,
        karma_service_id=karma_service_id,
    )
    return Response(status_code=204)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_violations(result: dict[str, Any]) -> list[dict[str, Any]]:
    if result.get("status") != "ok":
        return []
    agent_out = result.get("result", {})
    watcher_out = agent_out.get("result", agent_out)
    return watcher_out.get("violations", []) if isinstance(watcher_out, dict) else []


def _violation_window() -> dict[str, str]:
    now = datetime.now(UTC)
    return {
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
    }
