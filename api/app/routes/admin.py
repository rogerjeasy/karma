"""Admin-only routes — require the 'admin' role in users/{uid}.roles.

All endpoints return 403 for authenticated non-admin users.
"""
from __future__ import annotations

import datetime as dt
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from google.cloud.firestore_v1.base_query import FieldFilter

from app import firestore_client
from app.auth import require_admin
from app.models import SystemServiceCreate, SystemServiceResponse

router = APIRouter(prefix="/admin", tags=["admin"])


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
