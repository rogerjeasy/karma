"""svc-reporting — Downstream consumer service.

Reads `recent_charges:summary` from Redis every 60s for its dashboard widget.

The silent degradation:
  When v2 is running → Redis has fresh summary → fast path (p95 ~50ms)
  When v3 is running → Redis key expires → falls back to calling payments API
    directly → p95 climbs to ~600ms, throughput drops ~8%

This is the downstream impact that Karma's Forensic agent must detect and
quantify in the ghost report.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor

SERVICE_NAME = "svc-reporting"
REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379"
PAYMENTS_URL = os.getenv("PAYMENTS_URL", "http://svc-payments-v3:8080")
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN") or os.getenv("DT_API_TOKEN", "")

_redis: aioredis.Redis | None = None
_http: httpx.AsyncClient | None = None
_tracer: trace.Tracer | None = None


def _configure_otel() -> None:
    global _tracer
    resource = Resource.create({"service.name": SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    headers = {"Authorization": f"Api-Token {DT_OTEL_TOKEN}"} if DT_OTEL_TOKEN else {}
    exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, headers=headers)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(SERVICE_NAME)


@asynccontextmanager
async def lifespan(application: FastAPI):
    global _redis, _http
    _configure_otel()
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    _http = httpx.AsyncClient(base_url=PAYMENTS_URL, timeout=5.0)
    yield
    await _redis.aclose()
    await _http.aclose()


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


@app.get("/dashboard/charges-summary")
async def get_charges_summary() -> dict:
    """Returns the charges summary.

    Fast path (when v2 is running): reads from Redis cache.
    Slow fallback (when v3 is running — cache miss): calls payments API directly.
    """
    start = time.monotonic()

    with _tracer.start_as_current_span("reporting.get_charges_summary") as span:  # type: ignore[union-attr]
        # Try Redis cache first
        try:
            cached = await _redis.get("recent_charges:summary")  # type: ignore[union-attr]
        except Exception:
            cached = None

        if cached:
            span.set_attribute("cache.hit", True)
            elapsed_ms = (time.monotonic() - start) * 1000
            span.set_attribute("duration_ms", elapsed_ms)
            return {"source": "cache", "data": json.loads(cached), "duration_ms": elapsed_ms}

        # Cache miss — fall back to direct API call (the slow path)
        span.set_attribute("cache.hit", False)
        span.set_attribute("fallback.reason", "cache_miss_key_recent_charges_summary")

        try:
            response = await _http.post(  # type: ignore[union-attr]
                "/charge",
                json={"amount": 0.01, "currency": "USD"},
            )
            fallback_data = response.json()
        except Exception as exc:
            fallback_data = {"error": str(exc)}

        # The fallback path serializes requests — this is why throughput drops
        await asyncio.sleep(0.55)  # simulate the additional 550ms overhead

        elapsed_ms = (time.monotonic() - start) * 1000
        span.set_attribute("duration_ms", elapsed_ms)
        return {"source": "fallback", "data": fallback_data, "duration_ms": elapsed_ms}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}
