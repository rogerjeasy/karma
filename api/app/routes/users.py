"""User profile sync — called by the frontend after every sign-in/sign-up."""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from app import firestore_client
from app.auth import get_current_user
from app.models import UserSyncResponse

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
    return UserSyncResponse(uid=uid, email=user.get("email", ""))
