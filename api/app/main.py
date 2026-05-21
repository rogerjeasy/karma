"""Karma FastAPI gateway — entry point.

Registers all routes, configures CORS, Firebase Auth middleware,
and starts the Firestore SSE listener on startup.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.auth.exceptions import DefaultCredentialsError, TransportError

from app.config import settings
from app.models import HealthResponse
from app.routes import contracts, cutover, ghosts, services, stream, users

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    logger.info("karma_api_starting", version="0.1.0")
    try:
        stream.start_firestore_listener()
    except Exception as exc:
        logger.warning("firestore_listener_failed", error=str(exc))
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title="Karma API",
        description="API gateway for the Karma reincarnation agent system",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    @application.middleware("http")
    async def catch_gcp_errors(request: Request, call_next):  # type: ignore[no-untyped-def]
        try:
            return await call_next(request)
        except (DefaultCredentialsError, TransportError) as exc:
            logger.warning("gcp_credentials_unavailable", path=request.url.path, error=str(exc))
            return JSONResponse(
                status_code=503,
                content={
                    "detail": (
                        "GCP credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS"
                        " or run 'gcloud auth application-default login'."
                    )
                },
            )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(users.router)
    application.include_router(services.router)
    application.include_router(contracts.router)
    application.include_router(ghosts.router)
    application.include_router(cutover.router)
    application.include_router(stream.router)

    @application.get("/health", response_model=HealthResponse, tags=["meta"])
    async def health() -> HealthResponse:
        from app.firestore_client import get_db
        firestore_ok = False
        try:
            db = get_db()
            await db.collection("_health").document("ping").get()
            firestore_ok = True
        except Exception:
            pass

        agent_ok = bool(settings.agent_engine_resource_name)

        return HealthResponse(
            status="ok" if (firestore_ok and agent_ok) else "degraded",
            firestore=firestore_ok,
            agent_engine=agent_ok,
        )

    return application


app = create_app()
