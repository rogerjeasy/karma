"""svc-payments-v3 — The replacement payments service.

This is the NEW service that Karma watches after cutover.

What v3 is missing (the contracts it violates):
  1. Does NOT write to Redis — violates the side_effect/cache_warming contract
  2. Returns 409 WITHOUT `original_txn_id` — violates the error_semantics contract
     Body: {"error": "duplicate"}  ← missing original_txn_id field

All API tests and contract tests pass. Karma catches what tests miss.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from pydantic import BaseModel

SERVICE_NAME = "svc-payments-v3"
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN") or os.getenv("DT_API_TOKEN", "")

_idempotency: dict[str, str] = {}


def _configure_otel() -> None:
    resource = Resource.create({"service.name": SERVICE_NAME, "service.version": "3.0"})
    provider = TracerProvider(resource=resource)
    headers = {"Authorization": f"Api-Token {DT_OTEL_TOKEN}"} if DT_OTEL_TOKEN else {}
    exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, headers=headers)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


@asynccontextmanager
async def lifespan(application: FastAPI):
    _configure_otel()
    yield


app = FastAPI(title=SERVICE_NAME, version="3.0", lifespan=lifespan)
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
        # BUG (from v2's perspective): missing `original_txn_id` field
        # Downstream clients that parse this field get null silently.
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}
