"""svc-payments-v3 — The replacement payments service.

This is the NEW service that Karma watches after cutover.

Behavioral contracts this service can honor or break AT RUNTIME (for the live
demo). It starts HEALTHY — behaving like v2 — and a single control call flips it
into the regressed state so a judge can watch Karma catch the regression live:

  1. side_effect/cache_warming — when healthy, a background loop writes
     `recent_charges:summary` to Redis every 30s (emitting a
     `redis.SET recent_charges:summary` span). When broken, the loop stops
     writing and the span disappears from Dynatrace — svc-reporting then falls
     back to a slow synchronous call.
  2. error_semantics/409_body — when healthy, duplicate Idempotency-Key returns
     409 with `original_txn_id`. When broken, that field is omitted and
     downstream clients silently receive null.

Toggle at runtime:
  GET  /admin/contract                      → {"healthy": true|false}
  POST /admin/contract {"healthy": false}   → flips the contract state
    (guarded by the X-Karma-Control header when KARMA_CONTROL_TOKEN is set)

Default state is controlled by env V3_CONTRACT_HEALTHY (default "true").
All API tests and contract tests pass in both states. Karma catches what tests
miss.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import FastAPI, Header, HTTPException, Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from pydantic import BaseModel

SERVICE_NAME = "svc-payments-v3"
REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379"
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN") or os.getenv("DT_API_TOKEN", "")

# Shared secret that protects the runtime contract toggle. When set, callers must
# send it in the X-Karma-Control header. The Karma API holds this token and is
# the only intended caller (the dashboard "Break v3 live" button routes through
# the API, never hits this service directly).
KARMA_CONTROL_TOKEN = (os.getenv("KARMA_CONTROL_TOKEN") or "").strip()

# Default contract state. Healthy = behaves like v2 (writes the Redis key, returns
# original_txn_id). Set V3_CONTRACT_HEALTHY=false to start in the regressed state.
_contract_healthy: bool = (os.getenv("V3_CONTRACT_HEALTHY", "true").strip().lower() != "false")

_idempotency: dict[str, str] = {}
_redis: aioredis.Redis | None = None
_tracer: trace.Tracer | None = None


def _configure_otel() -> None:
    global _tracer
    resource = Resource.create({"service.name": SERVICE_NAME, "service.version": "3.0"})
    provider = TracerProvider(resource=resource)
    headers = {"Authorization": f"Api-Token {DT_OTEL_TOKEN}"} if DT_OTEL_TOKEN else {}
    exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, headers=headers)
    # SimpleSpanProcessor exports each span immediately — reliable on Cloud Run
    # where BatchSpanProcessor loses buffered spans on scale-down/SIGTERM.
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(SERVICE_NAME)


async def _cache_warming_loop() -> None:
    """Cache-warming side effect — writes the summary to Redis every 30s.

    Only runs while the contract is HEALTHY. When the demo "breaks" v3 the write
    is skipped, so the `redis.SET recent_charges:summary` span stops appearing in
    Dynatrace and svc-reporting degrades to its slow synchronous fallback. This is
    exactly the absence the Karma Watcher's side_effect/cache_warming predicate
    looks for.
    """
    while True:
        try:
            if _contract_healthy and _redis and _tracer:
                summary = json.dumps(
                    {
                        "count": len(_idempotency),
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                        "service": SERVICE_NAME,
                        "version": "3.0",
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
    try:
        await _redis.aclose()
    except Exception:
        pass


app = FastAPI(title=SERVICE_NAME, version="3.0", lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


class ChargeRequest(BaseModel):
    amount: float
    currency: str = "USD"
    idempotency_key: str | None = None


class ContractState(BaseModel):
    healthy: bool


@app.post("/charge")
async def charge(
    request: ChargeRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Response:
    key = idempotency_key or request.idempotency_key

    if key and key in _idempotency:
        if _contract_healthy:
            # Honors the error_semantics contract: include original_txn_id.
            body = json.dumps({"error": "duplicate", "original_txn_id": _idempotency[key]})
        else:
            # BROKEN: missing `original_txn_id`. Downstream clients that parse this
            # field get null silently — no exception raised, silent data corruption.
            body = json.dumps({"error": "duplicate"})
        return Response(content=body, status_code=409, media_type="application/json")

    txn_id = str(uuid.uuid4())
    if key:
        _idempotency[key] = txn_id

    await asyncio.sleep(0.082)  # ~82ms p50 — within spec
    return Response(
        content=json.dumps({"status": "ok", "txn_id": txn_id}),
        media_type="application/json",
    )


@app.get("/admin/contract")
async def get_contract_state() -> dict:
    """Return the current runtime contract state (no auth — read-only)."""
    return {
        "service": SERVICE_NAME,
        "healthy": _contract_healthy,
        "writes_cache": _contract_healthy,
        "returns_original_txn_id": _contract_healthy,
    }


@app.post("/admin/contract")
async def set_contract_state(
    state: ContractState,
    x_karma_control: str | None = Header(default=None, alias="X-Karma-Control"),
) -> dict:
    """Flip the runtime contract state. Guarded by X-Karma-Control when configured.

    healthy=true  → behaves like v2 (writes cache key, returns original_txn_id)
    healthy=false → regressed (no cache write, 409 omits original_txn_id)
    """
    if KARMA_CONTROL_TOKEN and x_karma_control != KARMA_CONTROL_TOKEN:
        raise HTTPException(status_code=403, detail="invalid or missing X-Karma-Control")

    global _contract_healthy
    _contract_healthy = state.healthy
    return {
        "service": SERVICE_NAME,
        "healthy": _contract_healthy,
        "writes_cache": _contract_healthy,
        "returns_original_txn_id": _contract_healthy,
    }


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME, "contract_healthy": _contract_healthy}
