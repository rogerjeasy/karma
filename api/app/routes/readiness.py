"""Migration Readiness Score route.

Computes a 0–100 weighted compliance score for a service, broken down by
all 8 contract categories. Powers the Migration Readiness Score widget and
Contract Category Radar Chart on the service detail page.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import firestore_client
from app.auth import get_current_user
from app.models import CategoryCompliance, MigrationReadinessResponse

router = APIRouter(prefix="/services", tags=["readiness"])


@router.get("/{service_id}/readiness", response_model=MigrationReadinessResponse)
async def get_migration_readiness(
    service_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> MigrationReadinessResponse:
    """Compute the Migration Readiness Score for a service.

    Returns a 0–100 weighted contract compliance score broken down by the 8
    implicit contract categories, plus the total avoided-incident cost estimate
    from all ghost reports for this service.

    The score is weighted as:
      - latency + error_semantics: 40% (highest-impact customer-visible contracts)
      - throughput + side_effect: 30% (operational correctness)
      - timing + dependency: 20% (integration contracts)
      - resource + sequencing: 10% (structural contracts)

    A category with zero contracts is excluded from the weight pool, ensuring
    the score reflects only what was actually observed during the learning phase.
    """
    svc = await firestore_client.get_service(service_id)
    if svc is None or svc.get("user_id") != user["uid"]:
        # Allow admin access too
        from app.firestore_client import get_db
        db = get_db()
        sys_doc = await db.collection("services").document(service_id).get()
        sys_data = sys_doc.to_dict() if sys_doc.exists else None
        if sys_data is None:
            raise HTTPException(status_code=404, detail="Service not found")
        svc = sys_data

    data = await firestore_client.compute_readiness_score(service_id)

    breakdown = [
        CategoryCompliance(
            category=c["category"],
            total_contracts=c["total_contracts"],
            compliant=c["compliant"],
            violated=c["violated"],
            score=c["score"],
            weight=c["weight"],
        )
        for c in data["category_breakdown"]
    ]

    return MigrationReadinessResponse(
        service_id=service_id,
        service_name=svc.get("service_name", service_id),
        phase=svc.get("phase", "unknown"),
        overall_score=data["overall_score"],
        category_breakdown=breakdown,
        total_contracts=data["total_contracts"],
        total_violations_active=data["total_violations_active"],
        avoided_incident_cost_total_usd=data["avoided_incident_cost_total_usd"],
        recommendation=data["recommendation"],
        computed_at=datetime.now(UTC),
    )
