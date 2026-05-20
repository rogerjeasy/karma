"""svc-payments-v2 — The deprecated payments service.

This is the OLD service that Karma will learn from.

Hidden side effect (the killer demo finding):
  An async background task writes `recent_charges:summary` to Redis every 30s.
  Nobody documented this. Nobody told the v3 team. Karma discovers it.

Error semantics contract:
  On duplicate Idempotency-Key, returns 409 with body:
    {"error": "duplicate", "original_txn_id": "<uuid>"}
  The field `original_txn_id` is what downstream clients parse.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import FastAPI, Header, Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel

SERVICE_NAME = "svc-payments-v2"
REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379"
OTEL_ENDPOINT = os.getenv(
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "http://localhost:4318/v1/traces",
)
# Classic API token (openTelemetryTrace.ingest scope) is required for OTLP ingest.
# Fall back to DT_API_TOKEN for local dev convenience.
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN") or os.getenv("DT_API_TOKEN", "")

# In-memory idempotency store (demo only — no persistence needed)
_idempotency: dict[str, str] = {}
_redis: aioredis.Redis | None = None
_tracer: trace.Tracer | None = None


def _configure_otel() -> None:
    global _tracer
    resource = Resource.create({"service.name": SERVICE_NAME, "service.version": "2.0"})
    provider = TracerProvider(resource=resource)
    headers = {}
    if DT_OTEL_TOKEN:
        headers["Authorization"] = f"Api-Token {DT_OTEL_TOKEN}"
    exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, headers=headers)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(SERVICE_NAME)


async def _cache_warming_loop() -> None:
    """Hidden side effect — writes summary to Redis every 30s.

    This is the undocumented behavior Karma must discover.
    svc-reporting reads `recent_charges:summary` directly from Redis.
    """
    while True:
        try:
            if _redis and _tracer:
                summary = json.dumps(
                    {
                        "count": len(_idempotency),
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                        "service": SERVICE_NAME,
                        "version": "2.0",
                    }
                )
                with _tracer.start_as_current_span("redis.SET recent_charges:summary") as span:
                    span.set_attribute("db.system", "redis")
                    span.set_attribute("db.operation", "SET")
                    span.set_attribute("db.redis.key", "recent_charges:summary")
                    await _redis.set("recent_charges:summary", summary, ex=120)
        except Exception:
            pass
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(application: FastAPI):
    global _redis
    _configure_otel()
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    task = asyncio.create_task(_cache_warming_loop())
    yield
    task.cancel()
    await _redis.aclose()


app = FastAPI(title=SERVICE_NAME, version="2.0", lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


class ChargeRequest(BaseModel):
    amount: float
    currency: str = "USD"
    idempotency_key: str | None = None


@app.post("/charge")
async def charge(
    request: ChargeRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Response:
    key = idempotency_key or request.idempotency_key

    if key and key in _idempotency:
        # Return 409 with original_txn_id — this field is part of the error semantics contract
        body = json.dumps({"error": "duplicate", "original_txn_id": _idempotency[key]})
        return Response(content=body, status_code=409, media_type="application/json")

    txn_id = str(uuid.uuid4())
    if key:
        _idempotency[key] = txn_id

    await asyncio.sleep(0.08)  # ~80ms p50
    return Response(
        content=json.dumps({"status": "ok", "txn_id": txn_id}),
        media_type="application/json",
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}
