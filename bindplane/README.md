# Bindplane Google Edition — Karma Pipeline Setup

Bindplane Google Edition is the managed OTel pipeline that routes telemetry from the Karma ADK agents (running in Vertex AI Agent Engine) to Dynatrace. It satisfies the hackathon requirement for Bindplane usage as part of the observability stack.

## Architecture

```
Karma Agents (Vertex AI Agent Engine)
  │  OTLP/gRPC or OTLP/HTTP (port 4317/4318)
  ▼
Bindplane Google Edition (GCP-managed)
  │  • Resource detection (adds cloud.*, k8s.*)
  │  • Attribute enrichment (karma.pipeline.version)
  │  • Health-check trace filtering
  │  • Batching + retry with backoff
  ▼
Dynatrace (OTLP/HTTP ingest)
  https://<DT_ENV>.live.dynatrace.com/api/v2/otlp
```

## Prerequisites

- Bindplane Google Edition enabled in your GCP project
- Dynatrace classic API token with scopes: `openTelemetryTrace.ingest`, `metrics.ingest`, `logs.ingest`
- `bindplane` CLI installed and authenticated

## Quick Start

### 1. Set your Dynatrace values

Edit `pipeline.yaml` and replace the two placeholders:

```bash
DT_ENV=your-environment-id          # e.g. abc12345
DT_OTEL_TOKEN=dt0c01.XXXXX...       # classic API token
```

Or use `sed` to substitute in-place:

```bash
sed -i \
  "s/<DT_ENV>/${DT_ENV}/g; s/<DT_OTEL_TOKEN>/${DT_OTEL_TOKEN}/g" \
  bindplane/pipeline.yaml
```

### 2. Apply and roll out the pipeline

```bash
# Authenticate (one-time)
bindplane login

# Apply the configuration
bindplane apply -f bindplane/pipeline.yaml

# Roll it out to all agents
bindplane rollout start karma-pipeline

# Check status
bindplane get configuration karma-pipeline
bindplane rollout status karma-pipeline
```

### 3. Configure Karma agents to export to Bindplane

Set the OTLP endpoint in your `.env` or Cloud Run environment:

```bash
# For local development (Bindplane running on localhost)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# For production (Bindplane running as a GCP-managed collector)
OTEL_EXPORTER_OTLP_ENDPOINT=http://<bindplane-collector-ip>:4317
```

`karma/otel.py` picks this up automatically via the `endpoint` parameter passed to `setup_otel()`.

### 4. Verify telemetry is flowing

In Dynatrace, run:

```dql
fetch logs
| filter log.source == "karma-agent"
| sort timestamp desc
| limit 20
```

You should see structured log entries from the Karma agents within 30 seconds of the first agent run.

For traces:

```dql
fetch spans
| filter service.name == "karma-agent-system"
| fields timestamp, span_name, gen_ai.agent.name, duration
| sort timestamp desc
| limit 50
```

## Signal mapping

| Karma OTel signal | Dynatrace storage | DQL namespace |
|---|---|---|
| Traces (karma.agent_run, gen_ai.chat, etc.) | Distributed Traces → Grail | `fetch spans` |
| Metrics (gen_ai.usage.*, karma.*) | Metrics → Grail | `timeseries` / `fetch metrics` |
| Logs (structlog JSON) | Logs → Grail | `fetch logs` |
| BizEvents (karma.ghost_report.created) | Business Analytics → Grail | `fetch bizevents` |

## Processor details

| Processor | Purpose |
|---|---|
| `karma-resource-detection` | Adds GCP metadata (project, region, service instance) to all signals |
| `karma-filter-internal` | Drops `/health`, `/healthz`, `/readyz` spans to reduce noise |
| `karma-attributes` | Stamps `karma.pipeline.version` for pipeline version tracking |
| `karma-batch` | Batches up to 1024 spans/metrics/logs per send, with 5s timeout |
| `karma-memory-limiter` | Caps pipeline memory at 75% before backpressure kicks in |

## Troubleshooting

**Pipeline won't start:**  
Check `bindplane get configuration karma-pipeline` for validation errors.

**No data in Dynatrace after 2 minutes:**  
1. Verify the `Authorization` header value — token must start with `dt0c01.`
2. Check that `openTelemetryTrace.ingest` and `metrics.ingest` scopes are enabled on the token
3. Run `bindplane rollout status karma-pipeline` for agent health

**Traces missing gen_ai.* attributes:**  
The Karma `otel_callbacks.py` sets these in `before_model_callback`. Confirm OTel is initialized before the first agent invocation (check `app.py` startup logs for `otel_setup_complete`).
