"""Ghost report retrieval routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app import firestore_client
from app.models import GhostReportResponse

router = APIRouter(prefix="/ghosts", tags=["ghosts"])


@router.get("", response_model=list[GhostReportResponse])
async def list_ghost_reports(
    service_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[GhostReportResponse]:
    docs = await firestore_client.list_ghost_reports(service_id=service_id, limit=limit)
    return [_doc_to_response(d) for d in docs]


@router.get("/{report_id}", response_model=GhostReportResponse)
async def get_ghost_report(report_id: str) -> GhostReportResponse:
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")
    return _doc_to_response(doc)


def _doc_to_response(doc: dict) -> GhostReportResponse:
    from datetime import datetime
    return GhostReportResponse(
        report_id=doc["report_id"],
        violation_id=doc["violation_id"],
        contract_id=doc.get("contract", {}).get("contract_id", ""),
        category=doc.get("contract", {}).get("category", ""),
        summary=doc["summary"],
        root_cause=doc["root_cause"],
        downstream_impact=doc["downstream_impact"],
        severity=doc.get("severity", "medium"),
        evidence_links=doc.get("evidence_links", []),
        remediation_suggestions=doc.get("remediation_suggestions", []),
        created_at=datetime.fromisoformat(str(doc["created_at"])),
    )
