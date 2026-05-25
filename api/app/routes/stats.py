"""Stats routes — public platform stats with optional user / admin scoping."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app import firestore_client
from app.auth import get_optional_user, require_admin
from app.models import StatsResponse

router = APIRouter(prefix="/stats", tags=["meta"])


@router.get("", response_model=StatsResponse)
async def get_stats(
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> StatsResponse:
    """Public stats endpoint — no authentication required.

    - Anonymous / no token  → platform-wide aggregate stats
    - Authenticated user    → stats scoped to that user's own services
    - Admin user            → platform-wide stats (same as anonymous, full scope)
    """
    if user is None:
        data = await firestore_client.compute_platform_stats()
        return StatsResponse(**data)

    # Check admin role without raising — fall back to user-scoped if not admin.
    from app.firestore_client import get_user as _get_profile
    profile = await _get_profile(user["uid"])
    roles: list[str] = (profile or {}).get("roles", ["user"])

    if "admin" in roles:
        data = await firestore_client.compute_platform_stats()
    else:
        data = await firestore_client.compute_user_stats(user["uid"])

    return StatsResponse(**data)


@router.get("/platform", response_model=StatsResponse)
async def get_platform_stats() -> StatsResponse:
    """Platform-wide stats (always unauthenticated). Kept for backwards compatibility."""
    data = await firestore_client.compute_platform_stats()
    return StatsResponse(**data)


@router.get("/admin/full", response_model=StatsResponse)
async def get_admin_stats(
    user: dict[str, Any] = Depends(require_admin),
) -> StatsResponse:
    """Full platform stats — admin only."""
    data = await firestore_client.compute_platform_stats()
    return StatsResponse(**data)
