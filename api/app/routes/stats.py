"""Stats routes — user-scoped and platform-wide."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app import firestore_client
from app.auth import get_current_user
from app.models import StatsResponse

router = APIRouter(prefix="/stats", tags=["meta"])


@router.get("", response_model=StatsResponse)
async def get_user_stats(
    user: dict[str, Any] = Depends(get_current_user),
) -> StatsResponse:
    """Return stats scoped to the authenticated user's services."""
    data = await firestore_client.compute_user_stats(user["uid"])
    return StatsResponse(**data)


@router.get("/platform", response_model=StatsResponse)
async def get_platform_stats() -> StatsResponse:
    """Platform-wide stats (unauthenticated, for public dashboards)."""
    data = await firestore_client.compute_platform_stats()
    return StatsResponse(**data)
