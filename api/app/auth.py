"""Firebase Authentication — FastAPI dependency.

Usage:
    from app.auth import get_current_user

    @router.get("/resource")
    async def endpoint(user: dict[str, Any] = Depends(get_current_user)):
        uid = user["uid"]
"""
from __future__ import annotations

from typing import Any

import firebase_admin
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

from app.config import settings

logger = structlog.get_logger(__name__)

_firebase_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App:
    global _firebase_app
    if _firebase_app is None:
        _firebase_app = firebase_admin.initialize_app(
            options={"projectId": settings.firebase_project_id}
        )
    return _firebase_app


# Keep the private alias for backwards compatibility within this module.
_get_firebase_app = get_firebase_app

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Verify the Firebase ID token in the Authorization header.

    Returns the decoded token payload (uid, email, name, picture, …).
    Raises 401 if the token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        decoded: dict[str, Any] = firebase_auth.verify_id_token(
            credentials.credentials,
            app=get_firebase_app(),
            check_revoked=False,
        )
        return decoded
    except firebase_auth.ExpiredIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired — please re-authenticate",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.CertificateFetchError,
        ValueError,
    ) as exc:
        logger.warning("invalid_firebase_token", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
