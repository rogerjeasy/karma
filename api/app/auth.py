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


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any] | None:
    """Like get_current_user but returns None instead of 401 when no token is present.

    Use for endpoints that are public but can return richer data when authenticated.
    """
    if credentials is None:
        return None
    try:
        decoded: dict[str, Any] = firebase_auth.verify_id_token(
            credentials.credentials,
            app=get_firebase_app(),
            check_revoked=False,
        )
        return decoded
    except (
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.InvalidIdTokenError,
        firebase_auth.CertificateFetchError,
        ValueError,
    ):
        return None


async def require_registered_user(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Dependency that rejects anonymous (guest) sessions.

    Guest/demo visitors sign in anonymously to explore the dashboard. Actions
    that reach outside Karma — like opening a real GitHub pull request — must be
    limited to users with a real account.
    """
    provider = (user.get("firebase") or {}).get("sign_in_provider")
    if provider == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in with a real account to open a remediation pull request.",
        )
    return user


async def require_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Dependency that additionally verifies the user has the 'admin' role.

    Raises 403 if the Firestore user document does not list 'admin' in roles.
    """
    from app.firestore_client import get_user as _get_user_profile
    profile = await _get_user_profile(user["uid"])
    roles: list[str] = (profile or {}).get("roles", ["user"])
    if "admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user
