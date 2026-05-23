"""User profile sync — called by the frontend after every sign-in/sign-up."""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from app import firestore_client
from app.auth import get_current_user
from app.models import UserProfile, UserSyncResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/sync", response_model=UserSyncResponse)
async def sync_user(user: dict[str, Any] = Depends(get_current_user)) -> UserSyncResponse:
    """Upsert the authenticated user's profile in Firestore.

    Creates or updates the document at users/{uid} so the backend has a
    record of who owns which services, contracts, and ghost reports.
    """
    uid: str = user["uid"]
    await firestore_client.upsert_user(
        uid,
        {
            "uid": uid,
            "email": user.get("email", ""),
            "display_name": user.get("name", ""),
            "photo_url": user.get("picture", ""),
            "last_seen_at": datetime.now(dt.UTC),
        },
    )
    profile = await firestore_client.get_user(uid)
    roles: list[str] = (profile or {}).get("roles", ["user"])
    return UserSyncResponse(uid=uid, email=user.get("email", ""), roles=roles)


@router.get("/me", response_model=UserProfile)
async def get_me(
    user: dict[str, Any] = Depends(get_current_user),
) -> UserProfile:
    """Return the authenticated user's full profile including roles."""
    profile = await firestore_client.get_user(user["uid"])
    if not profile:
        return UserProfile(uid=user["uid"], email=user.get("email", ""))
    return UserProfile(
        uid=profile["uid"],
        email=profile.get("email", user.get("email", "")),
        display_name=profile.get("display_name", ""),
        photo_url=profile.get("photo_url", ""),
        roles=profile.get("roles", ["user"]),
    )
