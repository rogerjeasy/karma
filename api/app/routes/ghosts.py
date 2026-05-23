"""Ghost report retrieval routes."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app import firestore_client
from app.auth import get_current_user
from app.models import GhostReportResponse

router = APIRouter(prefix="/ghosts", tags=["ghosts"])


@router.get("", response_model=list[GhostReportResponse])
async def list_ghost_reports(
    service_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[GhostReportResponse]:
    # If filtering by service, verify ownership first.
    if service_id is not None:
        svc = await firestore_client.get_service(service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Service not found")

    docs = await firestore_client.list_ghost_reports(
        user_id=user["uid"], service_id=service_id, limit=limit
    )
    return [_doc_to_response(d) for d in docs]


@router.get("/{report_id}", response_model=GhostReportResponse)
async def get_ghost_report(
    report_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> GhostReportResponse:
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")

    # Verify the report belongs to a service owned by this user.
    karma_service_id = doc.get("karma_service_id", "")
    if karma_service_id:
        svc = await firestore_client.get_service(karma_service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Ghost report not found")

    return _doc_to_response(doc)


def _doc_to_response(doc: dict[str, Any]) -> GhostReportResponse:
    from datetime import datetime
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
        created_at=datetime.fromisoformat(str(doc.get("created_at") or doc["saved_at"])),
    )
