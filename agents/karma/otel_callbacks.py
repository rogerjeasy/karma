"""ADK agent lifecycle callbacks that emit OpenTelemetry traces and metrics.

Hooks into every significant decision point of the ADK agent lifecycle to
produce a complete distributed trace visible in Dynatrace:

    karma.agent_run          ← wraps the entire agent invocation
      gen_ai.chat            ← one span per LLM turn (child of agent span)
      gen_ai.tool.call       ← one span per tool invocation (child of agent span)
        karma.dql_query      ← nested inside execute_dql tool spans
        karma.mcp_tool_call  ← nested inside MCP tool spans

Token usage (input/output/cached), estimated USD cost, and business counters
(contracts discovered, violations, ghost reports) are recorded as OTel metrics
from the after_model_callback so every Gemini call is reflected in Dynatrace.

Usage:
    from karma.otel_callbacks import make_telemetry_callbacks
    from karma.config import settings

    cbs = make_telemetry_callbacks("karma_learner", settings.model_pro)
    agent = Agent(name="karma_learner", ..., **cbs)
"""
from __future__ import annotations

import contextlib
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from karma.otel import (
    METRIC_TOOL_CALLS,
    METRIC_TOOL_ERRORS,
    SPAN_AGENT_RUN,
    SPAN_MODEL_CALL,
    SPAN_TOOL_CALL,
    get_tracer,
    record_business_metric,
    record_token_usage,
)

logger = logging.getLogger(__name__)


# ── Per-invocation span state ─────────────────────────────────────────────────


@dataclass
class _SpanState:
    """Holds all active OTel spans and context tokens for one agent invocation."""

    # Agent-level span — active for the entire invocation
    agent_span: Any = None
    agent_ctx_token: Any = None  # contextvars token, detached in after_agent

    # Current model turn
    model_turn: int = 0
    model_span: Any = None
    model_start_ns: float = 0.0

    # Active tool spans keyed by a stable call identifier
    # Value: (span, ctx_token, start_ns)
    tool_spans: dict[str, tuple[Any, Any, float]] = field(default_factory=dict)

    # Model name used for token cost attribution
    model_name: str = ""

    # Accumulated token usage across ALL model turns in this invocation.
    # Exposed via get_invocation_cost() so forensic agent can report investigation cost.
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0


# Global span-state registry — keyed by ADK invocation_id
_span_states: dict[str, _SpanState] = {}
_lock = threading.Lock()


def _get_state(invocation_id: str) -> _SpanState:
    with _lock:
        if invocation_id not in _span_states:
            _span_states[invocation_id] = _SpanState()
        return _span_states[invocation_id]


def _pop_state(invocation_id: str) -> _SpanState | None:
    with _lock:
        return _span_states.pop(invocation_id, None)


def _invocation_id_from(ctx: Any) -> str:
    """Extract invocation_id from a CallbackContext or ToolContext safely."""
    return (
        getattr(ctx, "invocation_id", None)
        or getattr(ctx, "_invocation_id", None)
        or "unknown"
    )


def _tool_call_key(tool_ctx: Any, tool_name: str) -> str:
    """Build a stable key for the tool span dict."""
    fn_call_id = (
        getattr(tool_ctx, "function_call_id", None)
        or getattr(tool_ctx, "tool_call_id", None)
    )
    if fn_call_id:
        return str(fn_call_id)
    # Fallback: use object id — unique within a process tick
    return f"{tool_name}:{id(tool_ctx)}"


# ── Callback factory ──────────────────────────────────────────────────────────


def _ensure_otel_configured() -> None:
    """Lazily initialise OTel providers if not yet configured.

    Agent Engine restores agents from a pickle so the module-level
    setup_otel() call in app.py does not run in the serving process.
    Calling this at the start of every before_agent callback ensures
    the TracerProvider and MeterProvider are configured before the
    first span is started.
    """
    try:
        import os

        from karma import otel as _otel_mod
        if not _otel_mod._configured:
            endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
            token = os.getenv("DT_OTEL_TOKEN", "") or os.getenv("DT_API_TOKEN", "")
            if endpoint or os.getenv("DT_ENV", ""):
                _otel_mod.setup_otel(endpoint=endpoint, token=token)
    except Exception:
        pass  # telemetry must never break agent execution


def make_telemetry_callbacks(
    agent_name: str,
    model_name: str,
) -> dict[str, Any]:
    """Return a dict of six ADK callback functions for one agent.

    Pass the result to Agent() via **kwargs:
        agent = Agent(name="...", ..., **make_telemetry_callbacks("...", "..."))

    Args:
        agent_name: ADK agent name (used as span and metric attribute).
        model_name: Gemini model string (e.g. "gemini-2.5-pro") used for
                    token cost attribution when the LlmRequest model is unavailable.
    """
    # ── 1. before_agent ───────────────────────────────────────────────────────

    def _before_agent(callback_context: Any) -> Any:
        """Start a karma.agent_run root span and attach it to the OTel context."""
        _ensure_otel_configured()
        inv_id = _invocation_id_from(callback_context)
        agent = getattr(callback_context, "agent_name", agent_name)

        try:
            from opentelemetry import context as otel_ctx
            from opentelemetry.trace import set_span_in_context

            tracer = get_tracer("karma.agents")
            span = tracer.start_span(
                SPAN_AGENT_RUN,
                attributes={
                    "gen_ai.system": "google_vertex",
                    "gen_ai.operation.name": "agent_run",
                    "karma.agent": agent,
                    "karma.invocation_id": inv_id,
                    "karma.model": model_name,
                },
            )
            # Attach so all nested spans (model, tool, DQL, MCP) are children
            ctx = set_span_in_context(span)
            token = otel_ctx.attach(ctx)

            state = _get_state(inv_id)
            state.agent_span = span
            state.agent_ctx_token = token
            state.model_name = model_name

            logger.debug("karma_otel before_agent agent=%s inv=%s", agent, inv_id)
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel before_agent error: %s", exc)

        return None  # let ADK proceed

    # ── 2. after_agent ────────────────────────────────────────────────────────

    def _after_agent(callback_context: Any, response: Any) -> Any:
        """Detach context and end the karma.agent_run span."""
        inv_id = _invocation_id_from(callback_context)

        try:
            from opentelemetry import context as otel_ctx
            from opentelemetry.trace import Status, StatusCode

            state = _pop_state(inv_id)
            if state is None:
                return None

            if state.agent_ctx_token is not None:
                with contextlib.suppress(Exception):
                    otel_ctx.detach(state.agent_ctx_token)

            if state.agent_span is not None:
                state.agent_span.set_attribute("karma.model_turns", state.model_turn)
                state.agent_span.set_status(Status(StatusCode.OK))
                state.agent_span.end()

            logger.debug("karma_otel after_agent agent=%s turns=%d", agent_name, state.model_turn)
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel after_agent error: %s", exc)

        return None

    # ── 3. before_model ───────────────────────────────────────────────────────

    def _before_model(callback_context: Any, llm_request: Any) -> Any:
        """Start a gen_ai.chat span (child of the active agent span)."""
        inv_id = _invocation_id_from(callback_context)

        try:
            # Prefer the model declared in the request; fall back to constructor arg
            req_model = getattr(llm_request, "model", None) or model_name

            state = _get_state(inv_id)
            state.model_turn += 1
            state.model_name = req_model or state.model_name or model_name
            state.model_start_ns = time.perf_counter()

            # tracer inherits the attached agent context automatically
            tracer = get_tracer("karma.agents")
            span = tracer.start_span(
                SPAN_MODEL_CALL,
                attributes={
                    "gen_ai.system": "google_vertex",
                    "gen_ai.operation.name": "chat",
                    "gen_ai.request.model": state.model_name,
                    "karma.agent": agent_name,
                    "karma.model_turn": state.model_turn,
                    "karma.invocation_id": inv_id,
                },
            )
            state.model_span = span

            logger.debug(
                "karma_otel before_model agent=%s model=%s turn=%d",
                agent_name, state.model_name, state.model_turn,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel before_model error: %s", exc)

        return None

    # ── 4. after_model ────────────────────────────────────────────────────────

    def _after_model(callback_context: Any, llm_response: Any) -> Any:
        """End the gen_ai.chat span and record token usage + cost metrics."""
        inv_id = _invocation_id_from(callback_context)

        try:
            from opentelemetry.trace import Status, StatusCode

            state = _get_state(inv_id)
            span = state.model_span
            if span is None:
                return None

            # Extract token counts from Gemini's usage_metadata
            usage = getattr(llm_response, "usage_metadata", None)
            input_tokens = getattr(usage, "prompt_token_count", 0) or 0
            output_tokens = getattr(usage, "candidates_token_count", 0) or 0
            total_tokens = getattr(usage, "total_token_count", 0) or (input_tokens + output_tokens)
            cached_tokens = getattr(usage, "cached_content_token_count", 0) or 0

            effective_model = state.model_name or model_name
            cost = record_token_usage(
                model=effective_model,
                agent=agent_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cached_tokens=cached_tokens,
            )

            # Decorate the span with GenAI semantic convention attributes
            span.set_attribute("gen_ai.usage.input_tokens", input_tokens)
            span.set_attribute("gen_ai.usage.output_tokens", output_tokens)
            span.set_attribute("gen_ai.usage.total_tokens", total_tokens)
            if cached_tokens > 0:
                span.set_attribute("gen_ai.usage.cache_read_input_tokens", cached_tokens)
            span.set_attribute("karma.estimated_cost_usd", round(cost, 8))
            span.set_attribute("karma.model_turn", state.model_turn)

            error_msg = getattr(llm_response, "error_message", None)
            if error_msg:
                span.set_status(Status(StatusCode.ERROR, str(error_msg)))
                span.set_attribute("karma.error", str(error_msg))
            else:
                span.set_status(Status(StatusCode.OK))

            elapsed = time.perf_counter() - state.model_start_ns
            span.set_attribute("karma.model_duration_seconds", round(elapsed, 4))
            span.end()
            state.model_span = None

            # Accumulate for get_invocation_cost() — used by get_session_cost_estimate tool
            state.total_input_tokens += input_tokens
            state.total_output_tokens += output_tokens
            state.total_cost_usd += cost

            logger.debug(
                "karma_otel after_model agent=%s in=%d out=%d cost=$%.6f cumulative=$%.6f",
                agent_name, input_tokens, output_tokens, cost, state.total_cost_usd,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel after_model error: %s", exc)

        return None

    # ── 5. before_tool ────────────────────────────────────────────────────────

    def _before_tool(tool: Any, args: dict[str, Any], tool_context: Any) -> Any:
        """Start a gen_ai.tool.call span and attach it so DQL/MCP child spans nest correctly."""
        inv_id = _invocation_id_from(tool_context)
        tool_name = getattr(tool, "name", None) or str(tool)
        call_key = _tool_call_key(tool_context, tool_name)

        try:
            from opentelemetry import context as otel_ctx
            from opentelemetry.trace import set_span_in_context

            state = _get_state(inv_id)
            record_business_metric(METRIC_TOOL_CALLS, attrs={"karma.agent": agent_name})

            # Build a compact arg preview (avoid leaking sensitive DQL content > 200 chars)
            arg_preview = {
                k: (str(v)[:200] if isinstance(v, str) else str(v)[:100])
                for k, v in (args or {}).items()
            }

            tracer = get_tracer("karma.agents")
            span = tracer.start_span(
                SPAN_TOOL_CALL,
                attributes={
                    "gen_ai.system": "google_vertex",
                    "gen_ai.tool.name": tool_name,
                    "gen_ai.operation.name": "tool_call",
                    "karma.agent": agent_name,
                    "karma.model_turn": state.model_turn,
                    "karma.invocation_id": inv_id,
                    "karma.tool.args_preview": str(arg_preview)[:500],
                },
            )

            # Attach tool span as the current context so execute_dql / _call_mcp_tool
            # internal spans are automatically nested as children of this span.
            ctx = set_span_in_context(span)
            token = otel_ctx.attach(ctx)

            state.tool_spans[call_key] = (span, token, time.perf_counter())

            logger.debug("karma_otel before_tool tool=%s inv=%s", tool_name, inv_id)
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel before_tool error: %s", exc)

        return None  # let ADK run the actual tool

    # ── 6. after_tool ─────────────────────────────────────────────────────────

    def _after_tool(
        tool: Any,
        args: dict[str, Any],
        tool_context: Any,
        tool_response: Any,
    ) -> Any:
        """Detach tool context and end the gen_ai.tool.call span."""
        inv_id = _invocation_id_from(tool_context)
        tool_name = getattr(tool, "name", None) or str(tool)
        call_key = _tool_call_key(tool_context, tool_name)

        try:
            from opentelemetry import context as otel_ctx
            from opentelemetry.trace import Status, StatusCode

            state = _get_state(inv_id)
            entry = state.tool_spans.pop(call_key, None)
            if entry is None:
                return None

            span, ctx_token, start_ns = entry

            # Detach BEFORE ending span to restore the parent (agent) context
            with contextlib.suppress(Exception):
                otel_ctx.detach(ctx_token)

            elapsed = time.perf_counter() - start_ns
            span.set_attribute("karma.tool.duration_seconds", round(elapsed, 4))

            # Inspect response for errors
            is_error = False
            if isinstance(tool_response, dict):
                error_val = tool_response.get("error")
                if error_val:
                    is_error = True
                    span.set_attribute("karma.tool.error", str(error_val)[:300])
                    record_business_metric(METRIC_TOOL_ERRORS, attrs={"karma.agent": agent_name})

                # Capture useful summary attributes per tool type
                if "state" in tool_response:  # DQL response
                    span.set_attribute("karma.dql.state", str(tool_response.get("state", "")))
                if "records" in tool_response.get("result", {}):
                    count = len(tool_response["result"]["records"])
                    span.set_attribute("karma.dql.record_count", count)
                if "saved" in tool_response:  # Firestore / Memory Bank
                    span.set_attribute("karma.tool.saved_count", int(tool_response.get("saved", 0)))
                if "published" in tool_response:  # Pub/Sub
                    span.set_attribute("karma.tool.published", bool(tool_response.get("published")))
                if "violation_id" in tool_response:
                    span.set_attribute("karma.violation_id", str(tool_response["violation_id"]))
                if "report_id" in tool_response:
                    span.set_attribute("karma.report_id", str(tool_response["report_id"]))

            # ── Business metrics: link tool outcomes to Karma events ──────────
            # These feed into the "contracts / violations / ghost reports" panels
            # in the Dynatrace dashboard alongside the token-spend metrics.
            if not is_error and isinstance(tool_response, dict):
                biz_attrs = {"karma.agent": agent_name}
                if tool_name == "save_contracts_to_firestore":
                    saved_n = int(tool_response.get("saved", 0))
                    if saved_n:
                        from karma.otel import METRIC_CONTRACTS_DISCOVERED
                        record_business_metric(METRIC_CONTRACTS_DISCOVERED, saved_n, biz_attrs)
                elif tool_name == "save_ghost_report_to_firestore":
                    if tool_response.get("saved"):
                        from karma.otel import METRIC_GHOST_REPORTS
                        record_business_metric(METRIC_GHOST_REPORTS, 1, biz_attrs)
                elif tool_name == "publish_violation_to_pubsub":
                    if tool_response.get("published"):
                        from karma.otel import METRIC_VIOLATIONS_DETECTED
                        record_business_metric(METRIC_VIOLATIONS_DETECTED, 1, biz_attrs)

            if is_error:
                span.set_status(Status(StatusCode.ERROR))
            else:
                span.set_status(Status(StatusCode.OK))

            span.end()

            logger.debug(
                "karma_otel after_tool tool=%s elapsed=%.3fs error=%s",
                tool_name, elapsed, is_error,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("karma_otel after_tool error: %s", exc)

        return None

    return {
        "before_agent_callback": _before_agent,
        "after_agent_callback": _after_agent,
        "before_model_callback": _before_model,
        "after_model_callback": _after_model,
        "before_tool_callback": _before_tool,
        "after_tool_callback": _after_tool,
    }


# ── Public accessor for forensic cost reporting ───────────────────────────────


def get_invocation_cost(invocation_id: str) -> dict[str, Any]:
    """Return accumulated token usage and cost for a specific agent invocation.

    Called by get_session_cost_estimate (in dynatrace_problems.py) which reads
    the invocation_id from the active OTel span set by before_tool_callback.

    Returns:
        {
            "input_tokens": <int>,
            "output_tokens": <int>,
            "total_tokens": <int>,
            "cost_usd": <float>,
            "model_turns": <int>,
            "model": "<model-name>"
        }
    """
    with _lock:
        state = _span_states.get(invocation_id)

    if state is None:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "model_turns": 0,
            "model": "unknown",
        }

    return {
        "input_tokens": state.total_input_tokens,
        "output_tokens": state.total_output_tokens,
        "total_tokens": state.total_input_tokens + state.total_output_tokens,
        "cost_usd": round(state.total_cost_usd, 8),
        "model_turns": state.model_turn,
        "model": state.model_name or "unknown",
    }
