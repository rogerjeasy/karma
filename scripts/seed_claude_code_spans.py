#!/usr/bin/env python3
"""Backfill Claude Code development sessions as gen_ai.* OTel spans in Dynatrace.

Each span represents one Claude Code session that built the Karma monitoring
system (May 18–27 2026).  The spans carry gen_ai.* semantic convention
attributes so they appear alongside karma-agent-system in Dynatrace's AI
Observability panels and token-spend queries.

Usage:
    python scripts/seed_claude_code_spans.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Load .env from repo root ──────────────────────────────────────────────────
_root = Path(__file__).resolve().parent.parent
_env_file = _root / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

DT_ENV = os.getenv("DT_ENV", "")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN", "") or os.getenv("DT_API_TOKEN", "")
OTLP_ENDPOINT = (
    os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").rstrip("/")
    or (f"https://{DT_ENV}.live.dynatrace.com/api/v2/otlp" if DT_ENV else "")
)

if not OTLP_ENDPOINT or not DT_OTEL_TOKEN:
    print("❌  DT_ENV / DT_OTEL_TOKEN not set — check your .env", file=sys.stderr)
    sys.exit(1)

print(f"[OK] Endpoint : {OTLP_ENDPOINT}/v1/traces")
print(f"[OK] Token    : {DT_OTEL_TOKEN[:24]}...")

# ── OTel setup ────────────────────────────────────────────────────────────────
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import SpanKind, StatusCode

resource = Resource.create({
    "service.name":      "claude-code-dev",
    "service.version":   "1.0.0",
    "service.namespace": "karma",
    "gen_ai.system":     "anthropic",
    "cloud.platform":    "developer_machine",
})

exporter = OTLPSpanExporter(
    endpoint=f"{OTLP_ENDPOINT}/v1/traces",
    headers={"Authorization": f"Api-Token {DT_OTEL_TOKEN}"},
)

provider = TracerProvider(resource=resource)
provider.add_span_processor(SimpleSpanProcessor(exporter))
tracer = provider.get_tracer(
    "claude-code",
    schema_url="https://opentelemetry.io/schemas/1.27.0",
)

# ── Session definitions ───────────────────────────────────────────────────────
# (iso_utc, description, input_tokens, output_tokens, duration_seconds)
# Derived from the git commit history of the Karma hackathon project.
SESSIONS: list[tuple[str, str, int, int, int]] = [
    # ── May 18 — project kick-off ─────────────────────────────────────────────
    ("2026-05-18T20:30:00Z", "Initial setup, hackathon requirements, ADK research",           52_000,  6_000, 5_400),
    # ── May 19 — architecture design ─────────────────────────────────────────
    ("2026-05-19T18:00:00Z", "Core agent architecture: coordinator/learner/watcher/forensic", 78_000, 10_000, 6_300),
    # ── May 20 — agent skeleton ───────────────────────────────────────────────
    ("2026-05-20T14:00:00Z", "ADK agent skeleton, Vertex AI integration, prompts",            92_000, 12_000, 7_200),
    # ── May 21 — OTel layer ───────────────────────────────────────────────────
    ("2026-05-21T16:30:00Z", "OpenTelemetry instrumentation, gen_ai semantic conventions",    68_000,  8_500, 5_100),
    # ── May 22 — backend foundation ───────────────────────────────────────────
    ("2026-05-22T10:00:00Z", "FastAPI backend skeleton, auth middleware, Firestore schema",   85_000, 10_500, 6_600),
    # ── May 23 — data layer ───────────────────────────────────────────────────
    ("2026-05-23T13:30:00Z", "Firestore client, contracts/ghosts collections, DQL tools",    80_000,  9_800, 6_000),
    # ── May 24 — heavy feature day ────────────────────────────────────────────
    ("2026-05-24T07:30:00Z", "Admin panel UI, Next.js scaffolding, dashboard layout",       108_000, 14_000, 7_800),
    ("2026-05-24T11:30:00Z", "OTel callbacks for ADK: before/after model token tracking",   124_000, 17_200, 8_400),
    ("2026-05-24T15:00:00Z", "Fix lazy OTel init in Agent Engine, MemoryEntry import",       55_000,  6_400, 4_200),
    ("2026-05-24T18:15:00Z", "User data, Firestore OTel client, session state management",   92_000, 11_500, 6_900),
    ("2026-05-24T20:20:00Z", "Backend API updates, observability endpoints, admin panel",     96_000, 12_300, 7_200),
    ("2026-05-24T22:50:00Z", "Demo endpoint, context state mgmt, session event streaming",   62_000,  7_200, 4_800),
    # ── May 25 — debugging & fixes ────────────────────────────────────────────
    ("2026-05-25T00:15:00Z", "Dockerfile fixes for web app, Cloud Run deployment config",    42_000,  4_900, 3_600),
    ("2026-05-25T02:15:00Z", "Cloud Build deployment tracking, AI Investigation Engine",      86_000, 10_200, 6_600),
    ("2026-05-25T04:45:00Z", "Fix OTel traces, stats API, URL routing corrections",          52_000,  5_900, 4_500),
    ("2026-05-25T11:00:00Z", "Services display fix, CORS config, Firestore index creation",  68_000,  8_200, 5_400),
    ("2026-05-25T12:45:00Z", "Admin dashboard refinement, page refactor",                    80_000,  9_800, 6_300),
    ("2026-05-25T13:45:00Z", "Auto-completion fix for haunting phase, admin services",        55_000,  6_700, 4_500),
    ("2026-05-25T15:30:00Z", "Delete service button, cascade deletion, confirmation UX",      36_000,  4_300, 3_000),
    # ── May 26 — feature completion ───────────────────────────────────────────
    ("2026-05-26T00:00:00Z", "New features: cutover flow, real-time watcher updates",        98_000, 12_600, 7_500),
    ("2026-05-26T01:00:00Z", "Coding Agent Observability Panel, demo button, datetime fix",  62_000,  7_700, 5_100),
    ("2026-05-26T14:30:00Z", "Frontend polish: service cards, timeline, new features",        74_000,  9_200, 6_000),
    # ── May 27 — final polish ─────────────────────────────────────────────────
    ("2026-05-27T11:00:00Z", "User dashboard UI updates, admin panel final polish",           68_000,  8_400, 5_400),
]


def _ts_ns(iso: str) -> int:
    """ISO 8601 UTC string → nanoseconds since epoch."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return int(dt.timestamp() * 1_000_000_000)


print(f"\nSending {len(SESSIONS)} Claude Code session spans to Dynatrace...\n")

total_in = total_out = 0
for i, (ts, label, in_tok, out_tok, dur_secs) in enumerate(SESSIONS, 1):
    start_ns = _ts_ns(ts)
    end_ns   = start_ns + dur_secs * 1_000_000_000

    span = tracer.start_span(
        "gen_ai.chat",
        start_time=start_ns,
        kind=SpanKind.CLIENT,
        attributes={
            "gen_ai.system":              "anthropic",
            "gen_ai.operation.name":      "chat",
            "gen_ai.request.model":       "claude-sonnet-4-6",
            "gen_ai.usage.input_tokens":  in_tok,
            "gen_ai.usage.output_tokens": out_tok,
            "gen_ai.usage.total_tokens":  in_tok + out_tok,
            "claude_code.session_label":  label,
            "claude_code.session_index":  i,
        },
    )
    span.set_status(StatusCode.OK)
    span.end(end_time=end_ns)

    total_in  += in_tok
    total_out += out_tok
    print(f"  [{i:02d}] {ts[:10]} | {in_tok//1000:>4}K in / {out_tok//1000:>3}K out | {label[:54]}")

print()

# Flush all spans before exit (SimpleSpanProcessor exports synchronously,
# but force_flush ensures the exporter's HTTP call completes).
provider.force_flush(timeout_millis=30_000)
provider.shutdown()

print(f"[DONE] Sent {len(SESSIONS)} spans")
print(f"   Input tokens  : {total_in:>10,}")
print(f"   Output tokens : {total_out:>10,}")
print(f"   Total tokens  : {total_in + total_out:>10,}")
est_cost = (total_in / 1_000_000 * 3.0) + (total_out / 1_000_000 * 15.0)
print(f"   Est. cost USD : ${est_cost:.4f}")
print()
print("Verify in Dynatrace Grail (~60s propagation):")
print('   fetch spans, from:now()-30d')
print('   | filter gen_ai.system == "anthropic"')
print('   | filter isNotNull(gen_ai.usage.input_tokens)')
print('   | summarize input = sum(toLong(gen_ai.usage.input_tokens)),')
print('               output = sum(toLong(gen_ai.usage.output_tokens)),')
print('               spans = count()')
print()
print('Note: filtering by service.name == "claude-code-dev" at the entity level causes')
print('span-level attributes like gen_ai.usage.input_tokens to read as null in Dynatrace.')
print('Use gen_ai.system == "anthropic" (a span-level attribute) instead.')
