"""Public platform stats — no authentication required."""
from __future__ import annotations

from fastapi import APIRouter

from app import firestore_client
from app.models import StatsResponse

router = APIRouter(prefix="/stats", tags=["meta"])


@router.get("", response_model=StatsResponse)
async def get_platform_stats() -> StatsResponse:
    data = await firestore_client.compute_platform_stats()
    return StatsResponse(**data)
