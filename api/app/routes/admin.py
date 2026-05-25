"""Admin-only routes — require the 'admin' role in users/{uid}.roles.

All endpoints return 403 for authenticated non-admin users.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1.base_query import FieldFilter

from app import agent_client, firestore_client
from app.auth import require_admin
from app.config import settings
from app.models import (
    ContractResponse,
    CutoverRequest,
    CutoverResponse,
    GhostReportResponse,
    SystemServiceCreate,
    SystemServiceResponse,
    WatcherRunResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/observability")
async def get_observability(
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Platform observability summary: session activity, engineering metrics, OTel status."""
    return await firestore_client.get_platform_observability(
        dt_configured=bool(settings.dt_otel_token),
        dt_env=settings.dt_env,
    )


@router.get("/system-services", response_model=list[SystemServiceResponse])
async def list_system_services(
    _: dict[str, Any] = Depends(require_admin),
) -> list[SystemServiceResponse]:
    """List all Karma infrastructure services being self-monitored."""
    svcs = await firestore_client.list_system_services()
    return [_to_system_response(s) for s in svcs]


@router.post(
    "/system-services",
    response_model=SystemServiceResponse,
    status_code=201,
)
async def create_system_service(
    body: SystemServiceCreate,
    _: dict[str, Any] = Depends(require_admin),
) -> SystemServiceResponse:
    """Register a Karma infrastructure service for self-monitoring."""
    service_id = str(uuid.uuid4())
    now = datetime.now(dt.UTC)
    data: dict[str, Any] = {
        "service_id": service_id,
        "service_name": body.service_name,
        "dynatrace_entity_id": body.dynatrace_entity_id,
        "replacement_service_id": body.replacement_service_id,
        "description": body.description,
        "url": body.url,
        "phase": "registered",
        "is_system": True,
        "user_id": "system",
        "error_message": None,
        "created_at": now,
        "updated_at": now,
    }
    await firestore_client.save_service_doc(service_id, data)
    return _to_system_response(data)


@router.get("/stats")
async def get_admin_stats(
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Platform-wide admin stats: total users, system services, ghost reports."""
    db = firestore_client.get_db()

    user_count = len([d async for d in db.collection("users").stream()])

    system_svcs = await firestore_client.list_system_services()
    haunting = [s for s in system_svcs if s.get("phase") == "haunting"]

    ghost_count = 0
    for svc in system_svcs:
        sid = svc.get("service_id", "")
        if not sid:
            continue
        q = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", sid))
            .limit(1000)
        )
        ghost_count += len([d async for d in q.stream()])

    return {
        "total_users": user_count,
        "total_system_services": len(system_svcs),
        "system_services_haunting": len(haunting),
        "system_ghost_reports": ghost_count,
    }


@router.get("/system-services/{service_id}", response_model=SystemServiceResponse)
async def get_system_service(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> SystemServiceResponse:
    """Return a single Karma infrastructure service by ID."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    return _to_system_response(svc)


@router.get(
    "/system-services/{service_id}/contracts",
    response_model=list[ContractResponse],
)
async def get_system_service_contracts(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> list[ContractResponse]:
    """Return all contracts discovered for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_contracts_for_service(service_id)
    return [_to_contract_response(d) for d in docs]


@router.get(
    "/system-services/{service_id}/ghosts",
    response_model=list[GhostReportResponse],
)
async def get_system_service_ghosts(
    service_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    _: dict[str, Any] = Depends(require_admin),
) -> list[GhostReportResponse]:
    """Return ghost reports for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_ghost_reports(
        user_id="system", service_id=service_id, limit=limit
    )
    return [_to_ghost_response(d) for d in docs]


@router.get(
    "/system-services/{service_id}/watcher-runs",
    response_model=list[WatcherRunResponse],
)
async def get_system_service_watcher_runs(
    service_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    _: dict[str, Any] = Depends(require_admin),
) -> list[WatcherRunResponse]:
    """Return watcher run history for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_watcher_runs(service_id, limit)
    return [_to_watcher_run_response(d) for d in docs]


@router.post(
    "/system-services/{service_id}/learn",
    status_code=202,
)
async def trigger_system_service_learning(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Kick off the Learner agent for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")

    await firestore_client.update_service_phase(
        service_id, "learning", extra={"error_message": None}
    )
    asyncio.create_task(
        _run_system_learning(
            service_id=service_id,
            service_name=svc["service_name"],
            dynatrace_entity_id=svc["dynatrace_entity_id"],
        )
    )
    return {"status": "accepted", "service_id": service_id}


@router.post(
    "/system-services/{service_id}/cutover",
    response_model=CutoverResponse,
)
async def cutover_system_service(
    service_id: str,
    payload: CutoverRequest,
    _: dict[str, Any] = Depends(require_admin),
) -> CutoverResponse:
    """Transition a system service to haunting phase and activate the Watcher."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")

    cutover_time = payload.cutover_time or datetime.now(dt.UTC)
    await firestore_client.update_service_phase(
        service_id,
        phase="haunting",
        extra={
            "replacement_service_id": payload.replacement_service_id,
            "cutover_time": cutover_time.isoformat(),
        },
    )
    return CutoverResponse(
        service_id=service_id,
        replacement_service_id=payload.replacement_service_id,
        cutover_time=cutover_time,
        watcher_activated=True,
    )


@router.get("/investigation-engine")
async def get_investigation_engine(
    user_id: str | None = Query(default=None, description="Filter by a specific Firebase UID"),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """AI Investigation Engine: per-user ghost report forensics and AI spend summary."""
    return await firestore_client.get_investigation_engine_stats(user_id_filter=user_id)


async def _run_system_learning(
    service_id: str,
    service_name: str,
    dynatrace_entity_id: str,
) -> None:
    try:
        result = await agent_client.trigger_learning(
            service_id=service_id,
            service_name=service_name,
            dynatrace_entity_id=dynatrace_entity_id,
            learning_window_days=14,
        )
        if result.get("status") == "error":
            msg = result.get("message", "Agent invocation failed")
            await firestore_client.update_service_phase(
                service_id, "error", extra={"error_message": msg}
            )
        else:
            await firestore_client.update_service_phase(service_id, "ready")
    except Exception as exc:
        await firestore_client.update_service_phase(
            service_id, "error", extra={"error_message": str(exc)}
        )


def _to_system_response(data: dict[str, Any]) -> SystemServiceResponse:
    return SystemServiceResponse(
        service_id=data["service_id"],
        service_name=data["service_name"],
        dynatrace_entity_id=data["dynatrace_entity_id"],
        replacement_service_id=data.get("replacement_service_id"),
        phase=data.get("phase", "registered"),
        error_message=data.get("error_message"),
        description=data.get("description"),
        url=data.get("url"),
        is_system=data.get("is_system", True),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


def _to_contract_response(doc: dict[str, Any]) -> ContractResponse:
    ts_raw = doc.get("saved_at") or doc.get("detected_at") or datetime.utcnow().isoformat()
    return ContractResponse(
        contract_id=doc["contract_id"],
        service_id=doc.get("service_id") or doc.get("karma_service_id", ""),
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(ts_raw)),
    )


def _to_ghost_response(doc: dict[str, Any]) -> GhostReportResponse:
    return GhostReportResponse(
        report_id=doc["report_id"],
        violation_id=doc["violation_id"],
        contract_id=doc.get("contract", {}).get("contract_id", ""),
        category=doc.get("contract", {}).get("category", ""),
        summary=doc["summary"],
        root_cause=doc["root_cause"],
        downstream_impact=doc["downstream_impact"],
        davis_ai_insights=doc.get("davis_ai_insights"),
        severity=doc.get("severity", "medium"),
        evidence_links=doc.get("evidence_links", []),
        remediation_suggestions=doc.get("remediation_suggestions", []),
        cost_estimate_usd=doc.get("cost_estimate_usd"),
        investigation_input_tokens=doc.get("investigation_input_tokens"),
        investigation_output_tokens=doc.get("investigation_output_tokens"),
        dynatrace_event_id=doc.get("dynatrace_event_id"),
        created_at=datetime.fromisoformat(
            str(doc.get("created_at") or doc["saved_at"])
        ),
    )


def _to_watcher_run_response(doc: dict[str, Any]) -> WatcherRunResponse:
    return WatcherRunResponse(
        run_id=doc["run_id"],
        service_id=doc["service_id"],
        service_name=doc.get("service_name"),
        run_at=datetime.fromisoformat(str(doc["run_at"])),
        contracts_checked=doc.get("contracts_checked", 0),
        violations_found=doc.get("violations_found", 0),
        duration_seconds=doc.get("duration_seconds"),
    )
