"""Cutover route — marks service as replaced and activates the Watcher."""
from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from datetime import datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from app import firestore_client
from app.auth import get_current_user
from app.models import CutoverRequest, CutoverResponse, WatcherRunRequest

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/cutover", tags=["cutover"])


@router.post("/{service_id}", response_model=CutoverResponse)
async def mark_cutover(
    service_id: str,
    payload: CutoverRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> CutoverResponse:
    doc = await firestore_client.get_service(service_id)
    if doc is None or doc.get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Service not found")

    cutover_time = payload.cutover_time or datetime.now(dt.UTC)
    log = logger.bind(service_id=service_id, replacement=payload.replacement_service_id)
    log.info("cutover_triggered")

    await firestore_client.update_service_phase(
        service_id,
        phase="haunting",
        extra={
            "replacement_service_id": payload.replacement_service_id,
            "cutover_time": cutover_time.isoformat(),
        },
    )

    log.info("watcher_activated")
    return CutoverResponse(
        service_id=service_id,
        replacement_service_id=payload.replacement_service_id,
        cutover_time=cutover_time,
        watcher_activated=True,
    )


@router.post("/watchers/run-now", status_code=status.HTTP_202_ACCEPTED)
async def run_watcher_now(
    payload: WatcherRunRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Trigger an immediate watcher run for the authenticated user's haunting services."""
    all_services = await firestore_client.list_services(user["uid"])
    targets = [
        s for s in all_services
        if s.get("phase") == "haunting"
        and (payload.service_id is None or s["service_id"] == payload.service_id)
    ]

    if not targets:
        return {"status": "no_active_watchers"}

    asyncio.create_task(_execute_watcher_chain(targets))
    return {
        "status": "accepted",
        "triggered": [{"service_id": s["service_id"]} for s in targets],
    }


async def _execute_watcher_chain(targets: list[dict[str, Any]]) -> None:
    import time

    from app import agent_client
    from app.config import settings

    for svc in targets:
        karma_service_id = svc["service_id"]
        log = logger.bind(karma_service_id=karma_service_id)

        contracts = await firestore_client.list_contracts_for_service(karma_service_id)
        if not contracts:
            log.info("watcher_skipped_no_contracts")
            await firestore_client.save_watcher_run(
                str(uuid.uuid4()),
                {
                    "run_id": str(uuid.uuid4()),
                    "service_id": karma_service_id,
                    "service_name": svc.get("service_name"),
                    "run_at": datetime.now(dt.UTC).isoformat(),
                    "contracts_checked": 0,
                    "violations_found": 0,
                    "duration_seconds": 0.0,
                    "skipped": True,
                    "skip_reason": "no_contracts",
                },
            )
            continue

        log.info("watcher_running", contract_count=len(contracts))
        t0 = time.monotonic()
        watcher_result = await agent_client.trigger_watcher(
            old_service_id=svc["dynatrace_entity_id"],
            new_service_id=svc.get("replacement_service_id", ""),
            contracts=contracts,
            karma_service_id=karma_service_id,
        )
        elapsed = round(time.monotonic() - t0, 2)

        violations = _extract_violations(watcher_result)
        log.info("watcher_complete", violations_found=len(violations))

        run_id = str(uuid.uuid4())
        await firestore_client.save_watcher_run(
            run_id,
            {
                "run_id": run_id,
                "service_id": karma_service_id,
                "service_name": svc.get("service_name"),
                "run_at": datetime.now(dt.UTC).isoformat(),
                "contracts_checked": len(contracts),
                "violations_found": len(violations),
                "duration_seconds": elapsed,
                "skipped": False,
            },
        )

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
            if not v.get("needs_forensic"):
                continue
            contract = _find_contract(contracts, v.get("contract_id", ""))
            if contract is None:
                log.warning("violation_contract_not_found", contract_id=v.get("contract_id"))
                continue

            violation_id = v.get("violation_id") or str(uuid.uuid4())
            log.info("triggering_forensic", violation_id=violation_id)
            await agent_client.trigger_forensic(
                violation_id=violation_id,
                contract=contract,
                new_service_id=svc.get("replacement_service_id", ""),
                violation_window=_violation_window(),
                karma_service_id=karma_service_id,
            )


def _extract_violations(result: dict[str, Any]) -> list[dict[str, Any]]:
    if result.get("status") != "ok":
        return []
    agent_out = result.get("result", {})
    watcher_out = agent_out.get("result", agent_out)
    return watcher_out.get("violations", []) if isinstance(watcher_out, dict) else []


def _find_contract(contracts: list[dict[str, Any]], contract_id: str) -> dict[str, Any] | None:
    return next((c for c in contracts if c.get("contract_id") == contract_id), None)


def _violation_window() -> dict[str, str]:
    now = datetime.now(dt.UTC)
    return {
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
    }
