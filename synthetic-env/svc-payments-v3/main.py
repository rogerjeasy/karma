"""svc-payments-v3 — The replacement payments service.

This is the NEW service that Karma watches after cutover. It exposes the same
enriched surface as v2 (so the comparison is apples-to-apples) and can honor or
break several behavioral contracts AT RUNTIME for the live demo. It starts
HEALTHY — behaving like v2 — and a single control call flips it into the
regressed state so a judge can watch Karma catch the regression live.

Regressions that activate when the contract is BROKEN:
  1. side_effect/cache_warming — the background loop stops writing
     `recent_charges:summary` to Redis, so the `redis.SET` span disappears and
     svc-reporting falls back to its slow synchronous path.
  2. error_semantics/409_body — duplicate Idempotency-Key returns 409 WITHOUT
     `original_txn_id`; downstream clients silently receive null.
  3. dependency/fraud_check — /charge stops fanning out to the fraud-check
     service (the `fraud-check.score` CLIENT span vanishes).
  4. latency/p95 — /charge p50 climbs from ~82ms to ~190ms.

Healthy state is byte-for-byte equivalent to v2's behavior, so nothing a test
asserts changes — Karma catches what tests miss.

Toggle at runtime:
  GET  /admin/contract                      → {"healthy": true|false}
  POST /admin/contract {"healthy": false}   → flips the contract state
    (guarded by the X-Karma-Control header when KARMA_CONTROL_TOKEN is set)

Default state is controlled by env V3_CONTRACT_HEALTHY (default "true").
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
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import SpanKind
from pydantic import BaseModel

SERVICE_NAME = "svc-payments-v3"
REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379"
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN") or os.getenv("DT_API_TOKEN", "")

ALLOWED_CURRENCIES = {"USD", "EUR", "GBP", "CHF", "JPY"}

# Shared secret that protects the runtime contract toggle. When set, callers must
# send it in the X-Karma-Control header. The Karma API holds this token and is
# the only intended caller (the dashboard "Break v3 live" button routes through
# the API, never hits this service directly).
KARMA_CONTROL_TOKEN = (os.getenv("KARMA_CONTROL_TOKEN") or "").strip()

# Default contract state. Healthy = behaves like v2 (writes the Redis key, returns
# original_txn_id, fans out to fraud-check, fast latency). Set
# V3_CONTRACT_HEALTHY=false to start in the regressed state.
_contract_healthy: bool = (os.getenv("V3_CONTRACT_HEALTHY", "true").strip().lower() != "false")

_idempotency: dict[str, str] = {}
_charges: "deque[dict]" = deque(maxlen=500)
_charge_index: dict[str, dict] = {}
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


def _pool_gauge() -> dict[str, int]:
    in_use = random.randint(2, 14)
    return {"db.pool.size": 16, "db.pool.in_use": in_use}


async def _jittered_sleep(p50: float, sigma: float, *, tail_p: float = 0.0, tail_extra: float = 0.0) -> float:
    delay = max(0.005, random.gauss(p50, sigma))
    if tail_p and random.random() < tail_p:
        delay += abs(random.gauss(tail_extra, tail_extra * 0.4))
    await asyncio.sleep(delay)
    return delay


async def _fraud_check(amount: float) -> None:
    """Downstream dependency fan-out. Present only while the contract is healthy —
    when broken, v3 drops this call and the `fraud-check.score` span vanishes."""
    if not _tracer:
        return
    with _tracer.start_as_current_span("fraud-check.score", kind=SpanKind.CLIENT) as span:
        span.set_attribute("peer.service", "svc-fraud-check")
        span.set_attribute("rpc.system", "http")
        span.set_attribute("payments.amount", amount)
        await _jittered_sleep(0.012, 0.003)
        span.set_attribute("fraud.score", round(random.uniform(0.0, 0.35), 3))


async def _cache_warming_loop() -> None:
    """Cache-warming side effect — writes the summary to Redis every 30s.

    Only runs while the contract is HEALTHY. When the demo "breaks" v3 the write
    is skipped, so the `redis.SET recent_charges:summary` span stops appearing in
    Dynatrace and svc-reporting degrades to its slow synchronous fallback.
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


class RefundRequest(BaseModel):
    txn_id: str
    amount: float | None = None


class ContractState(BaseModel):
    healthy: bool


def _validate_charge(request: ChargeRequest) -> None:
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
        if _contract_healthy:
            # Honors the error_semantics contract: include original_txn_id.
            body = json.dumps({"error": "duplicate", "original_txn_id": _idempotency[key]})
        else:
            # BROKEN: missing `original_txn_id`. Downstream clients that parse this
            # field get null silently — no exception raised, silent data corruption.
            body = json.dumps({"error": "duplicate"})
        return Response(content=body, status_code=409, media_type="application/json")

    # Dependency fan-out — present only when healthy. Broken state drops it,
    # which the Watcher catches as a dependency-contract violation.
    if _contract_healthy:
        await _fraud_check(request.amount)

    if random.random() < 0.015:
        body = json.dumps({"error": "card_declined", "reason": "insufficient_funds"})
        return Response(content=body, status_code=402, media_type="application/json")

    txn_id = str(uuid.uuid4())
    if key:
        _idempotency[key] = txn_id

    span = trace.get_current_span()
    for k, v in _pool_gauge().items():
        span.set_attribute(k, v)

    if _contract_healthy:
        elapsed = await _jittered_sleep(0.082, 0.012, tail_p=0.03, tail_extra=0.18)  # ~82ms p50 — within spec
    else:
        # BROKEN: latency regression — p50 climbs to ~190ms with a fatter tail.
        elapsed = await _jittered_sleep(0.19, 0.03, tail_p=0.08, tail_extra=0.32)
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
    await _jittered_sleep(0.02, 0.004)
    record = _charge_index.get(txn_id)
    if not record:
        raise HTTPException(status_code=404, detail={"error": "not_found", "txn_id": txn_id})
    return Response(content=json.dumps(record), media_type="application/json")


@app.get("/charges")
async def list_charges(limit: int = 20) -> Response:
    await _jittered_sleep(0.04, 0.008)
    items = list(_charges)[-max(1, min(limit, 100)):]
    return Response(
        content=json.dumps({"count": len(items), "charges": list(reversed(items))}),
        media_type="application/json",
    )


@app.post("/refund")
async def refund(request: RefundRequest) -> Response:
    original = _charge_index.get(request.txn_id)
    if not original:
        raise HTTPException(status_code=404, detail={"error": "unknown_txn", "txn_id": request.txn_id})

    if _tracer:
        with _tracer.start_as_current_span("ledger.reverse", kind=SpanKind.CLIENT) as span:
            span.set_attribute("peer.service", "svc-ledger")
            span.set_attribute("db.operation", "reverse")
            await _jittered_sleep(0.03, 0.006)
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

    await _jittered_sleep(0.12, 0.02, tail_p=0.02, tail_extra=0.2)
    refund_id = str(uuid.uuid4())
    return Response(
        content=json.dumps({"status": "refunded", "refund_id": refund_id, "txn_id": request.txn_id}),
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
        "calls_fraud_check": _contract_healthy,
    }


@app.post("/admin/contract")
async def set_contract_state(
    state: ContractState,
    x_karma_control: str | None = Header(default=None, alias="X-Karma-Control"),
) -> dict:
    """Flip the runtime contract state. Guarded by X-Karma-Control when configured.

    healthy=true  → behaves like v2 (cache write, original_txn_id, fraud-check, fast)
    healthy=false → regressed (no cache write, 409 omits field, no fraud-check, slow)
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
        "calls_fraud_check": _contract_healthy,
    }


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME, "contract_healthy": _contract_healthy}
