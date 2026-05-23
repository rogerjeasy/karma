# Monitoring Claude Code with Dynatrace

This document explains how to route Claude Code's development-session telemetry to Dynatrace, so you can observe your AI-assisted engineering workflow the same way Karma observes its own AI agents.

---

## Why this matters

Karma uses `gen_ai.*` OTel semantic conventions to expose token usage, latency, and cost for its ADK agents. Claude Code can emit the same signals. Routing both into the same Dynatrace tenant lets you see:

- How much of your AI budget is spent on coding assistance vs. production agent runs
- Which engineering sessions produce the most code changes (proxy for agent productivity)
- Side-by-side comparison: Claude Code token cost vs. Karma agent token cost per incident

---

## Step 1 — Enable OpenTelemetry in Claude Code

Claude Code supports OTLP export via environment variables. Add these to your shell profile (`.zshrc`, `.bashrc`, or PowerShell `$PROFILE`):

```bash
# Dynatrace OTLP endpoint (classic API)
export OTEL_EXPORTER_OTLP_ENDPOINT="https://<DT_ENV>.live.dynatrace.com/api/v2/otlp"

# Classic API token — same DT_OTEL_TOKEN used by Karma agents
# Required scope: openTelemetryTrace.ingest
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Api-Token <DT_OTEL_TOKEN>"

# Tag Claude Code sessions as a distinct service in Dynatrace
export OTEL_SERVICE_NAME="claude-code-dev"
export OTEL_RESOURCE_ATTRIBUTES="gen_ai.system=anthropic,cloud.platform=local,deployment.environment=development"

# Use OTLP/HTTP (not gRPC) — Dynatrace classic API requires HTTP
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
```

For Windows PowerShell, add to `$PROFILE`:

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "https://<DT_ENV>.live.dynatrace.com/api/v2/otlp"
$env:OTEL_EXPORTER_OTLP_HEADERS  = "Authorization=Api-Token <DT_OTEL_TOKEN>"
$env:OTEL_SERVICE_NAME            = "claude-code-dev"
$env:OTEL_RESOURCE_ATTRIBUTES     = "gen_ai.system=anthropic,cloud.platform=local,deployment.environment=development"
$env:OTEL_EXPORTER_OTLP_PROTOCOL  = "http/protobuf"
```

---

## Step 2 — Verify telemetry is reaching Dynatrace

After starting a Claude Code session, run this DQL query in the Dynatrace Grail notebook:

```dql
fetch spans
| filter service.name == "claude-code-dev"
| fields timestamp, span_name, gen_ai.system, duration
| sort timestamp desc
| limit 20
```

You should see spans within 60 seconds of the first Claude Code tool call.

---

## Step 3 — Query Claude Code token usage

```dql
// Total tokens used by Claude Code sessions today
fetch spans
| filter service.name == "claude-code-dev"
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize
    input_tokens  = sum(gen_ai.usage.input_tokens),
    output_tokens = sum(gen_ai.usage.output_tokens),
    total_tokens  = sum(gen_ai.usage.input_tokens) + sum(gen_ai.usage.output_tokens)
```

```dql
// Claude Code sessions per day (by user)
fetch spans
| filter service.name == "claude-code-dev"
| filter span_name == "gen_ai.chat" OR span_name contains "session"
| summarize sessions = count(), by: {date(timestamp), host.name}
| sort date(timestamp) desc
```

```dql
// Side-by-side: Claude Code vs. Karma agent token cost
fetch spans
| filter service.name in ["claude-code-dev", "karma-agent-system"]
| summarize
    input_tokens  = sum(gen_ai.usage.input_tokens),
    output_tokens = sum(gen_ai.usage.output_tokens),
    by: {service.name}
```

---

## Step 4 — Add a Claude Code tile to the Karma dashboard

Import `docs/dynatrace-dashboard.json` (see that file for instructions) and add this manual tile to the dashboard JSON under `"tiles"`:

```json
{
  "name": "Claude Code — Token Usage (Dev Sessions)",
  "tileType": "DATA_EXPLORER",
  "configured": true,
  "bounds": { "top": 1520, "left": 0, "width": 608, "height": 304 },
  "customName": "Claude Code Token Usage",
  "queries": [
    {
      "id": "A",
      "spaceAggregation": "AUTO",
      "timeAggregation": "DEFAULT",
      "metricSelector": "gen_ai.usage.input_tokens:sum:filter(eq(service.name,claude-code-dev)):names",
      "type": "METRIC_HEATMAP",
      "displayName": "Input Tokens (Claude Code)",
      "enabled": true
    },
    {
      "id": "B",
      "spaceAggregation": "AUTO",
      "timeAggregation": "DEFAULT",
      "metricSelector": "gen_ai.usage.output_tokens:sum:filter(eq(service.name,claude-code-dev)):names",
      "type": "METRIC_HEATMAP",
      "displayName": "Output Tokens (Claude Code)",
      "enabled": true
    }
  ],
  "visualConfig": {
    "type": "GRAPH_CHART",
    "rules": [
      { "matcher": "A:", "properties": { "color": "BLUE", "seriesType": "BAR" }, "seriesOverrides": [] },
      { "matcher": "B:", "properties": { "color": "GREEN", "seriesType": "BAR" }, "seriesOverrides": [] }
    ]
  }
}
```

---

## Step 5 — Set up a Dynatrace metric event alert

Alert when Claude Code token spend exceeds a daily threshold:

1. In Dynatrace → **Manage** → **Settings** → **Anomaly detection** → **Metric events**
2. Create a new metric event:
   - **Metric selector:** `gen_ai.usage.input_tokens:sum:filter(eq(service.name,claude-code-dev)):default(0)`
   - **Threshold:** above `500000` tokens in a 24-hour rollup
   - **Alert title:** `Claude Code daily token budget exceeded`
   - **Event properties:** `gen_ai.system = anthropic`

This mirrors the Davis AI anomaly detection Karma uses for production contract violations — same observability pattern applied to the development workflow itself.

---

## What Karma and Claude Code share in Dynatrace

| Signal | Karma agents | Claude Code |
|---|---|---|
| `service.name` | `karma-agent-system` | `claude-code-dev` |
| `gen_ai.system` | `google_vertex` | `anthropic` |
| `gen_ai.usage.input_tokens` | per model turn | per session turn |
| `gen_ai.usage.output_tokens` | per model turn | per session turn |
| Span hierarchy | `karma.agent_run` → `gen_ai.chat` → `gen_ai.tool.call` | `gen_ai.chat` → tool spans |
| Storage | Dynatrace Grail traces | Dynatrace Grail traces |

Both sets of spans are queryable in the same `fetch spans` DQL namespace, which means a single Dynatrace notebook covers both production AI agent cost and development AI assistant cost.
