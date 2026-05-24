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

    # ── Engineering-metrics span ──────────────────────────────────────────────
    # Emits a deployment event visible in Dynatrace Distributed Tracing.
    # Covers the hackathon's "engineering metrics" signal category by recording
    # the service cutover as a blue/green deployment with real GitHub metrics.
    _deployment_record: dict[str, Any] | None = None
    try:
        from opentelemetry import trace as _trace
        from opentelemetry.trace import Status, StatusCode

        from app.config import settings
        from app.github_client import fetch_deployment_metrics

        _tracer = _trace.get_tracer("karma.api")
        with _tracer.start_as_current_span("karma.deployment") as _span:
            _span.set_attribute("deployment.environment", "production")
            _span.set_attribute("deployment.strategy", "blue_green")
            _span.set_attribute("deployment.service.name", doc.get("service_name", service_id))
            _span.set_attribute("deployment.service.id", service_id)
            _old = doc.get("dynatrace_entity_id", service_id)
            _span.set_attribute("deployment.old_version", _old)
            _span.set_attribute("deployment.new_version", payload.replacement_service_id)
            _span.set_attribute("deployment.timestamp", cutover_time.isoformat())
            _span.set_attribute("user.id", user["uid"])
            _span.set_attribute("user.email", user.get("email", ""))
            _span.set_attribute("organization.id", "karma")
            _span.set_attribute("session.id", service_id)

            # Fetch real engineering metrics from GitHub if a token and repo are
            # configured. The repo is taken from the service doc first, then
            # falls back to the project-level GITHUB_REPO config setting.
            _gh_token = settings.github_token
            _gh_repo = doc.get("github_repo") or settings.github_repo
            if _gh_token and _gh_repo:
                # Measure activity since the service was registered (first cutover)
                # or since the last recorded cutover time if available.
                _since = _parse_dt(
                    doc.get("last_cutover_time") or doc.get("created_at", cutover_time)
                )
                _metrics = await fetch_deployment_metrics(
                    repo=_gh_repo,
                    since=_since,
                    token=_gh_token,
                )
                _deployment_record = {
                    "service_id": service_id,
                    "service_name": doc.get("service_name", service_id),
                    "deployed_at": cutover_time.isoformat(),
                    "commits": _metrics["commits"],
                    "pull_requests": _metrics["pull_requests"],
                    "lines_added": _metrics["lines_added"],
                    "lines_removed": _metrics["lines_removed"],
                    "github_repo": _gh_repo,
                }
                _span.set_attribute("git.commits", _metrics["commits"])
                _span.set_attribute("git.pull_requests", _metrics["pull_requests"])
                _span.set_attribute("git.lines_added", _metrics["lines_added"])
                _span.set_attribute("git.lines_removed", _metrics["lines_removed"])
                _span.set_attribute("git.repo", _gh_repo)

            _span.add_event("deployment.cutover", {
                "service.old": doc.get("dynatrace_entity_id", service_id),
                "service.new": payload.replacement_service_id,
            })
            _span.set_status(Status(StatusCode.OK))
    except Exception:
        pass  # telemetry must never break the cutover

    if _deployment_record is not None:
        import contextlib
        with contextlib.suppress(Exception):
            await firestore_client.save_deployment_metrics(
                str(uuid.uuid4()), _deployment_record
            )

    # Record cutover time so the next cutover can measure activity from this point.
    await firestore_client.update_service_phase(
        service_id,
        phase="haunting",
        extra={"last_cutover_time": cutover_time.isoformat()},
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

    asyncio.create_task(_execute_watcher_chain(
        targets,
        user_context={
            "user_id": user["uid"],
            "user_email": user.get("email", ""),
            "organization_id": "karma",
        },
    ))
    return {
        "status": "accepted",
        "triggered": [{"service_id": s["service_id"]} for s in targets],
    }


async def _execute_watcher_chain(
    targets: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
) -> None:
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
            user_context=user_context,
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
                user_context=user_context,
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


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))
