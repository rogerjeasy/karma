#!/usr/bin/env python3
"""Claude Code Stop hook — emit a gen_ai.chat OTel span to Dynatrace.

Claude Code calls this script (via stdin JSON) whenever the assistant stops.
The span represents one Claude Code turn/session with estimated token counts
derived from the turn_count supplied by the hook runtime.

Hook JSON input (stdin):
    {
      "session_id": "<uuid>",
      "transcript_path": "<path>",
      "turn_count": <int>      -- number of assistant turns
    }

Install by adding to .claude/settings.json:
    "hooks": {
      "Stop": [{
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "/c/Python314/python.exe C:/Users/User/Documents/karma/scripts/emit_claude_session_span.py"
        }]
      }]
    }
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# ── Load .env ─────────────────────────────────────────────────────────────────
_root = Path(__file__).resolve().parent.parent
_env = _root / ".env"
if _env.exists():
    for _l in _env.read_text().splitlines():
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _, _v = _l.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

DT_ENV = os.getenv("DT_ENV", "")
DT_OTEL_TOKEN = os.getenv("DT_OTEL_TOKEN", "") or os.getenv("DT_API_TOKEN", "")
OTLP_ENDPOINT = (
    os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").rstrip("/")
    or (f"https://{DT_ENV}.live.dynatrace.com/api/v2/otlp" if DT_ENV else "")
)

if not OTLP_ENDPOINT or not DT_OTEL_TOKEN:
    sys.exit(0)  # silently skip when DT is not configured

# ── Parse stdin ───────────────────────────────────────────────────────────────
payload: dict = {}
try:
    raw = sys.stdin.read()
    if raw.strip():
        payload = json.loads(raw)
except Exception:
    pass

session_id  = payload.get("session_id", f"unknown-{int(time.time())}")
turn_count  = int(payload.get("turn_count") or 0)

# Estimate token usage from turn count.
# Empirical averages for claude-sonnet-4-6 on a large codebase:
#   ~25 000 input tokens/turn (context, history, file reads, tool results)
#   ~3 000 output tokens/turn (code, explanations)
in_tok  = max(turn_count, 1) * 25_000
out_tok = max(turn_count, 1) *  3_000

# ── OTel ─────────────────────────────────────────────────────────────────────
try:
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
    tracer = provider.get_tracer("claude-code", schema_url="https://opentelemetry.io/schemas/1.27.0")

    span = tracer.start_span(
        "gen_ai.chat",
        kind=SpanKind.CLIENT,
        attributes={
            "gen_ai.system":              "anthropic",
            "gen_ai.operation.name":      "chat",
            "gen_ai.request.model":       "claude-sonnet-4-6",
            "gen_ai.usage.input_tokens":  in_tok,
            "gen_ai.usage.output_tokens": out_tok,
            "gen_ai.usage.total_tokens":  in_tok + out_tok,
            "claude_code.session_id":     session_id,
            "claude_code.turn_count":     turn_count,
        },
    )
    span.set_status(StatusCode.OK)
    span.end()

    provider.force_flush(timeout_millis=10_000)
    provider.shutdown()
except Exception:
    pass  # telemetry must never break Claude Code
