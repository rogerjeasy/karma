"""Agent Engine entry point — exports the coordinator agent for deployment.

OTel must be initialised before any agent module is imported so that the
TracerProvider and MeterProvider are registered before the first span is
created.  The setup_otel() call here is idempotent — safe to call multiple
times during tests or local runs.

The AdkApp deployment wrapper is constructed in the CI deploy script so this
module has no Vertex AI SDK imports at module level.
"""
from __future__ import annotations

from karma.config import settings

# ── Step 1: configure OTel providers before any agent code loads ─────────────
from karma.otel import setup_otel

try:
    # dt_otel_endpoint raises ValueError when DT_ENV is not configured.
    # setup_otel() gracefully no-ops when the endpoint string is empty.
    _otel_endpoint = settings.dt_otel_endpoint
except ValueError:
    _otel_endpoint = ""

setup_otel(endpoint=_otel_endpoint, token=settings.dt_otel_token)

# ── Step 2: build the agent graph ────────────────────────────────────────────
from karma.coordinator import create_coordinator_agent  # noqa: E402

app = create_coordinator_agent()
