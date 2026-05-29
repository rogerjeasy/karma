"""Public 'Live Proof' route.

Surfaces a contract Karma learned from a REAL service (its own production API,
registered as a system service) so anyone — including a hackathon judge who
hasn't signed in — can see that the Learner works on live Dynatrace telemetry,
not just the scripted synthetic demo environment.

Public by design (uses get_optional_user). The data exposed is non-sensitive:
behavioral-contract summaries of Karma's own services.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends

from app import firestore_client
from app.auth import get_optional_user
from app.config import settings
from app.models import LiveProofContract, LiveProofResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/proof", tags=["proof"])

_DEMO_MARKER = "[demo]"


def _evidence_dql(contract: dict[str, Any]) -> str | None:
    """Pull one representative real DQL query from a contract's evidence."""
    for ev in contract.get("evidence") or []:
        if isinstance(ev, dict) and ev.get("dql"):
            return str(ev["dql"])
    predicate = contract.get("violation_predicate") or {}
    if predicate.get("test_dql"):
        return str(predicate["test_dql"])
    return None


def _parse_dt(raw: Any) -> datetime | None:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


@router.get("/live", response_model=LiveProofResponse)
async def live_proof(
    _: dict[str, Any] | None = Depends(get_optional_user),
) -> LiveProofResponse:
    """Return a contract learned from a real system service, or available=False."""
    try:
        services = await firestore_client.list_system_services()
    except Exception as exc:  # never let the public page error out
        logger.warning("live_proof_services_failed", error=str(exc))
        return LiveProofResponse(available=False)

    # Prefer a service explicitly flagged as the showcase, then any real one.
    services.sort(key=lambda s: (not s.get("showcase", False)))

    for svc in services:
        sid = svc.get("service_id")
        name = svc.get("service_name", "")
        if not sid or _DEMO_MARKER in name:
            continue
        try:
            contracts = await firestore_client.list_contracts_for_service(sid)
        except Exception as exc:
            logger.warning("live_proof_contracts_failed", service_id=sid, error=str(exc))
            continue

        validated = [c for c in contracts if c.get("validated")]
        chosen = validated or contracts
        if not chosen:
            continue

        items = [
            LiveProofContract(
                category=c.get("category", ""),
                subcategory=c.get("subcategory", ""),
                description=c.get("description", ""),
                confidence=float(c.get("confidence") or 0.0),
                validated=bool(c.get("validated")),
                evidence_dql=_evidence_dql(c),
            )
            for c in chosen[:5]
        ]
        learned_at = _parse_dt(chosen[0].get("detected_at") or chosen[0].get("saved_at"))

        return LiveProofResponse(
            available=True,
            service_name=name,
            dynatrace_entity_id=svc.get("dynatrace_entity_id"),
            dt_env=settings.dt_env or None,
            learned_at=learned_at,
            contract_count=len(chosen),
            contracts=items,
        )

    return LiveProofResponse(available=False)
