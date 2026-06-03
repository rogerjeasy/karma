"""svc-payments-v2 — The deprecated payments service.

This is the OLD service that Karma will learn from. It is intentionally richer
than a single endpoint so the Learner can discover contracts across most of its
eight categories from real telemetry:

  * latency        — each endpoint has its own jittered p50/p95/p99 band
  * error_semantics — 400 (bad amount), 422 (bad currency), 402 (declined),
                       409 (duplicate Idempotency-Key, body carries original_txn_id)
  * throughput     — sustained QPS across a mix of endpoints
  * side_effect    — async background loop writes recent_charges:summary to Redis
                     every 30s (the killer finding); /refund writes an audit record
  * dependency     — every /charge fans out to a downstream fraud-check call
                     (CLIENT span with peer.service), at a stable frequency
  * resource       — span attributes expose a connection-pool gauge

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
import random
import uuid
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import FastAPI, Header, HTTPException, Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.trace import SpanKind
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

ALLOWED_CURRENCIES = {"USD", "EUR", "GBP", "CHF", "JPY"}

# In-memory idempotency store (demo only — no persistence needed)
_idempotency: dict[str, str] = {}
# Recent charges, for GET /charge/{id} and GET /charges (bounded ring buffer)
_charges: "deque[dict]" = deque(maxlen=500)
_charge_index: dict[str, dict] = {}
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
    # SimpleSpanProcessor exports each span immediately — reliable on Cloud Run
    # where BatchSpanProcessor loses buffered spans on scale-down/SIGTERM.
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(SERVICE_NAME)


def _pool_gauge() -> dict[str, int]:
    """Simulated connection-pool usage — feeds the resource-contract signal."""
    in_use = random.randint(2, 14)
    return {"db.pool.size": 16, "db.pool.in_use": in_use}


async def _jittered_sleep(p50: float, sigma: float, *, tail_p: float = 0.0, tail_extra: float = 0.0) -> float:
    """Sleep for a Gaussian-jittered duration so each endpoint has a realistic
    p50/p95/p99 latency band. Returns the elapsed seconds (for span attrs).

    tail_p / tail_extra inject an occasional slow tail so p99 separates from p95.
    """
    delay = max(0.005, random.gauss(p50, sigma))
    if tail_p and random.random() < tail_p:
        delay += abs(random.gauss(tail_extra, tail_extra * 0.4))
    await asyncio.sleep(delay)
    return delay


async def _fraud_check(amount: float) -> None:
    """Downstream dependency fan-out — a CLIENT span to the fraud-scoring service.

    This stable per-charge dependency is what Karma learns as a dependency
    contract; v3 (when broken) drops it, which the Watcher catches.
    """
    if not _tracer:
        return
    with _tracer.start_as_current_span("fraud-check.score", kind=SpanKind.CLIENT) as span:
        span.set_attribute("peer.service", "svc-fraud-check")
        span.set_attribute("rpc.system", "http")
        span.set_attribute("payments.amount", amount)
        # Fraud scoring is fast but not free.
        await _jittered_sleep(0.012, 0.003)
        span.set_attribute("fraud.score", round(random.uniform(0.0, 0.35), 3))


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


class RefundRequest(BaseModel):
    txn_id: str
    amount: float | None = None


def _validate_charge(request: ChargeRequest) -> None:
    """Error-semantics contract: deterministic validation responses."""
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail={"error": "invalid_amount", "field": "amount"})
    if request.currency.upper() not in ALLOWED_CURRENCIES:
        raise HTTPException(
            status_code=422,
            detail={"error": "unsupported_currency", "field": "currency", "allowed": sorted(ALLOWED_CURRENCIES)},
        )


@app.post("/charge")
async def charge(
    request: ChargeRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Response:
    _validate_charge(request)
    key = idempotency_key or request.idempotency_key

    if key and key in _idempotency:
        # Return 409 with original_txn_id — this field is part of the error semantics contract
        body = json.dumps({"error": "duplicate", "original_txn_id": _idempotency[key]})
        return Response(content=body, status_code=409, media_type="application/json")

    # Downstream dependency fan-out (stable per-charge frequency).
    await _fraud_check(request.amount)

    # ~1.5% of charges are declined by the processor (402) — part of error semantics.
    if random.random() < 0.015:
        body = json.dumps({"error": "card_declined", "reason": "insufficient_funds"})
        return Response(content=body, status_code=402, media_type="application/json")

    txn_id = str(uuid.uuid4())
    if key:
        _idempotency[key] = txn_id

    span = trace.get_current_span()
    for k, v in _pool_gauge().items():
        span.set_attribute(k, v)

    elapsed = await _jittered_sleep(0.08, 0.012, tail_p=0.03, tail_extra=0.18)  # ~80ms p50, tail to ~p99
    span.set_attribute("payments.latency_ms", round(elapsed * 1000, 1))

    record = {
        "txn_id": txn_id,
        "amount": request.amount,
        "currency": request.currency.upper(),
        "status": "ok",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _charges.append(record)
    _charge_index[txn_id] = record
    return Response(content=json.dumps({"status": "ok", "txn_id": txn_id}), media_type="application/json")


@app.get("/charge/{txn_id}")
async def get_charge(txn_id: str) -> Response:
    """Status lookup — a fast read path with its own latency band."""
    await _jittered_sleep(0.02, 0.004)
    record = _charge_index.get(txn_id)
    if not record:
        raise HTTPException(status_code=404, detail={"error": "not_found", "txn_id": txn_id})
    return Response(content=json.dumps(record), media_type="application/json")


@app.get("/charges")
async def list_charges(limit: int = 20) -> Response:
    """Recent-charges list — a medium read path."""
    await _jittered_sleep(0.04, 0.008)
    items = list(_charges)[-max(1, min(limit, 100)):]
    return Response(
        content=json.dumps({"count": len(items), "charges": list(reversed(items))}),
        media_type="application/json",
    )


@app.post("/refund")
async def refund(request: RefundRequest) -> Response:
    """Refund path — fans out to the ledger (dependency) and writes an audit record
    (a second, lower-frequency side effect)."""
    original = _charge_index.get(request.txn_id)
    if not original:
        raise HTTPException(status_code=404, detail={"error": "unknown_txn", "txn_id": request.txn_id})

    if _tracer:
        with _tracer.start_as_current_span("ledger.reverse", kind=SpanKind.CLIENT) as span:
            span.set_attribute("peer.service", "svc-ledger")
            span.set_attribute("db.operation", "reverse")
            await _jittered_sleep(0.03, 0.006)
        # Second side effect: append an audit record to Redis.
        try:
            if _redis:
                with _tracer.start_as_current_span("redis.LPUSH audit:refunds") as span:
                    span.set_attribute("db.system", "redis")
                    span.set_attribute("db.operation", "LPUSH")
                    span.set_attribute("db.redis.key", "audit:refunds")
                    await _redis.lpush(
                        "audit:refunds",
                        json.dumps({"txn_id": request.txn_id, "at": datetime.now(timezone.utc).isoformat()}),
                    )
        except Exception:
            pass

    await _jittered_sleep(0.12, 0.02, tail_p=0.02, tail_extra=0.2)  # ~120ms p50
    refund_id = str(uuid.uuid4())
    return Response(
        content=json.dumps({"status": "refunded", "refund_id": refund_id, "txn_id": request.txn_id}),
        media_type="application/json",
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}
