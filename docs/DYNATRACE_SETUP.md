# Dynatrace Setup Guide

This guide covers everything needed to configure Dynatrace for the Karma demo.

---

## 1. Create a Dynatrace SaaS Trial

1. Go to [dynatrace.com/trial](https://www.dynatrace.com/trial/)
2. Sign up for a 15-day free trial
3. Note your **environment name** — it appears in the URL: `https://<environment-name>.apps.dynatrace.com`

---

## 2. Authentication — Platform Token (required)

> **Important:** Dynatrace does NOT support OAuth clients for connecting directly to the MCP server.
> OAuth-derived tokens are only valid for 5 minutes and cannot be refreshed automatically.
> **Use a Platform Token exclusively.**

1. In Dynatrace: **Settings → Access Tokens → Platform Tokens**
2. Click **Generate new token**
3. Name it: `karma-mcp-token`

### Required Platform Token scopes

The following scopes are required. Group them when creating the token in
**Settings → Access Tokens → Platform Tokens**.

**MCP Gateway access (mandatory for any MCP tool invocation):**
```
mcp-gateway:servers:invoke
mcp-gateway:servers:read
```

**Grail Query Agent** (`create-dql`):
```
davis-copilot:nl2dql:execute
```

**DQL Explanation Agent** (`explain-dql`):
```
davis-copilot:dql2nl:execute
```

**Help Agent** (`ask-dynatrace-docs`):
```
davis-copilot:conversations:execute
```

**Data Analysis Agent** (`execute-dql`) — add data-type permissions for what you query:
```
storage:buckets:read
storage:logs:read       ← logs
storage:metrics:read    ← metrics
storage:spans:read      ← traces
```

**Root Cause Agent + Root Cause Details Agent** (`query-problems`, `get-problem-by-id`):
```
storage:buckets:read
storage:events:read
```

**Forecasting, Changepoint, and threshold analysis agents:**
```
storage:buckets:read
davis:analyzers:read
davis:analyzers:execute
```

**Smartscape Agent** (`get-entity-id`, `get-entity-name`):
```
storage:entities:read
```

**Document Agent** (`find-documents`):
```
document:documents:read
```

**Troubleshooting Agent** (`find-troubleshooting-guides`):
```
davis-copilot:document-search:execute
```

**Vulnerability Agent** (`get-vulnerabilities`):
```
storage:buckets:read
storage:security.events:read
```

**Kubernetes Agent** (`get-events-for-kubernetes-cluster`):
```
storage:buckets:read
storage:events:read
```

4. Copy the generated token — it will not be shown again
5. Store it in Secret Manager:

```bash
echo -n "<your-platform-token>" | \
  gcloud secrets create dt-api-token \
    --data-file=- \
    --project=skillbridge-76a4c
```

---

## 3. MCP Server URL

```
https://{environment-name}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp
```

Replace `{environment-name}` with your Dynatrace environment identifier (visible in the browser URL when logged in).

---

## 4. Verify the MCP Connection

Test the hosted MCP endpoint:

```bash
export DT_ENV=<your-environment-name>
export DT_API_TOKEN=<your-platform-token>

curl -s \
  -H "Authorization: Bearer $DT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1,"params":{}}' \
  "https://${DT_ENV}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp"
```

Expected: a JSON response listing all available MCP tools with their exact `name` fields.
Save this output — the tool `name` values are what goes into the agent code.

If you get 401: confirm the token has `mcp-gateway:servers:invoke` and `mcp-gateway:servers:read` scopes.
If you get 404: confirm the environment name in the URL is correct.

---

## 5. Available MCP Tools (confirmed from tools/list)

The table below shows the **confirmed MCP tool names** from the live `tools/list` response
(stored in `docs/dynatrace-mcp-info.md`). Use the exact `name` values in agent code —
these use hyphens, not underscores.

| MCP `name` | Agent title | What it does | Key scope(s) |
|---|---|---|---|
| `create-dql` | Grail Query Agent | Generate DQL from natural language (does not execute) | `davis-copilot:nl2dql:execute` |
| `execute-dql` | Data Analysis Agent | Execute DQL, return raw results (max 1 000 records) | `storage:buckets:read` + data permissions |
| `explain-dql` | DQL Explanation Agent | Explain a DQL query in natural language | `davis-copilot:dql2nl:execute` |
| `ask-dynatrace-docs` | Help Agent | Answer Dynatrace product questions | `davis-copilot:conversations:execute` |
| `query-problems` | Root Cause Agent | List all Davis problems (active or closed, max 200) | `storage:buckets:read`, `storage:events:read` |
| `get-problem-by-id` | Root Cause Details Agent | Full details of a specific Davis problem | `storage:buckets:read`, `storage:events:read` |
| `get-vulnerabilities` | Vulnerability Agent | List active security vulnerabilities | `storage:buckets:read`, `storage:security.events:read` |
| `get-events-for-kubernetes-cluster` | Kubernetes Agent | K8s events for all clusters or a specific one | `storage:buckets:read`, `storage:events:read` |
| `timeseries-forecast` | Forecasting Agent | Predict future timeseries values | `storage:buckets:read`, `davis:analyzers:*` |
| `timeseries-novelty-detection` | Changepoint Agent | Find outliers, level changes, and trends | `storage:buckets:read`, `davis:analyzers:*` |
| `adaptive-anomaly-detector` | Autoadaptive Threshold Agent | Anomaly detection with learned adaptive threshold | `storage:buckets:read`, `davis:analyzers:*` |
| `seasonal-baseline-anomaly-detector` | Seasonal Baseline Agent | Anomaly detection accounting for seasonal patterns | `storage:buckets:read`, `davis:analyzers:*` |
| `static-threshold-analyzer` | Static Threshold Agent | Anomaly detection against a fixed threshold | `storage:buckets:read`, `davis:analyzers:*` |
| `find-documents` | Document Agent | Search Dashboards and Notebooks by title | `document:documents:read` |
| `find-troubleshooting-guides` | Troubleshooting Agent | Find troubleshooting guide Notebooks | `davis-copilot:document-search:execute` |
| `get-entity-id` | Smartscape Agent | Resolve entity name + type → Dynatrace entity ID | `storage:entities:read` |
| `get-entity-name` | Smartscape Agent | Resolve Dynatrace entity ID → human-readable name | `storage:entities:read` |

> **Not available via MCP:** `send_event`, `execute_davis_analyzer`, `verify_dql`, and
> `chat_with_davis_copilot` do not exist in the current toolset. Karma uses the
> Logs Ingest API directly for self-observability (see §8 below).

---

## 6. Configure OpenTelemetry Ingest

The synthetic environment services export OTel traces and logs to your Dynatrace tenant.

### OTel endpoint
```
https://<environment-name>.live.dynatrace.com/api/v2/otlp
```

### Authentication header
```
Authorization: Api-Token <your-api-token>
```

> Note: OTel ingest uses a **classic API token** (not a Platform Token). Create a separate API token with:
> - `openTelemetryTrace.ingest`
> - `logs.ingest`
> - `metrics.ingest`
> - `events.ingest` — required for `push_ghost_report_to_dynatrace` (service timeline annotations)
> - `bizevents.ingest` — required for Karma self-observability BizEvents (§8); available on Dynatrace trials
> - `slo.write` — required for `create_slo_from_contract` (auto-register contracts as Dynatrace SLOs)

Store it as `dt-otel-token` in Secret Manager.

---

## 7. Environment Variables

Only `DT_ENV` and `DT_API_TOKEN` are required. All other Dynatrace URLs are
derived by the agent code from `DT_ENV` — never set them as raw URL strings
in `.env` because pydantic-settings does not expand `${VAR}` references.

```bash
# Required
DT_ENV=<your-environment-name>
DT_API_TOKEN=<your-platform-token>

# Optional — leave blank; derived from DT_ENV automatically
# Set only if you need a local stdio override: stdio://localhost
DT_MCP_URL=

# Classic API token for OTel ingest (separate from Platform Token)
DT_OTEL_TOKEN=<your-otel-classic-token>
```

The agent code exposes the following derived URLs via `settings`:

| Property | Derived value |
|---|---|
| `settings.dt_base_url` | `https://<DT_ENV>.apps.dynatrace.com` |
| `settings.dt_classic_base_url` | `https://<DT_ENV>.live.dynatrace.com` |
| `settings.dt_mcp_endpoint` | `<dt_base_url>/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp` |
| `settings.dt_logs_endpoint` | `<dt_classic_base_url>/api/v2/logs/ingest` |
| `settings.dt_bizevents_endpoint` | `<dt_classic_base_url>/api/v2/bizevents/ingest` |
| `settings.dt_slo_endpoint` | `<dt_classic_base_url>/api/v2/slo` |
| `settings.dt_otel_endpoint` | `<dt_classic_base_url>/api/v2/otlp` |

---

## 8. BizEvents Ingest (Karma Self-Observability)

The Dynatrace MCP server does not expose a `send_event` tool. Karma calls the
**BizEvents Ingest API v2** directly to emit every agent decision as a structured
CloudEvent, visible as business-process telemetry in Dynatrace Grail.

**Endpoint** (derived from `settings.dt_bizevents_endpoint`):
```
POST https://<DT_ENV>.live.dynatrace.com/api/v2/bizevents/ingest
```

**Authentication:**
```
Authorization: Api-Token <DT_OTEL_TOKEN>
Content-Type: application/cloudevents+json
```

**Required scope on the classic API token:** `bizevents.ingest`
This is a classic API scope — distinct from the platform scope
`storage:bizevents:write` — and is available on Dynatrace free trials.

**Querying emitted events via DQL:**
```dql
fetch bizevents
| filter startsWith(event.type, "karma.")
| sort timestamp desc
| limit 50
```

```dql
// Ghost reports only
fetch bizevents
| filter event.type == "karma.ghost_report.created"
| fields timestamp, event.data.title, event.data.severity, event.data.report_id
| sort timestamp desc
| limit 10
```

Karma emits events under these types (defined in `dynatrace_events.py`):

| Event type (`event.type`) | Emitted by | When |
|---|---|---|
| `karma.learning.started` | Learner | After resolving the service entity ID |
| `karma.contract.discovered` | Learner | After each validated contract |
| `karma.contract.rejected` | Learner | When a contract fails validation |
| `karma.learning.complete` | Learner | After all contracts are saved |
| `karma.violation.detected` | Watcher (via Forensic) | When a predicate fails |
| `karma.ghost_report.created` | Forensic | After producing a ghost report |

The `dt_logs_endpoint` (`/api/v2/logs/ingest`) is still available for external
service OTel logs. Karma self-observability moved to BizEvents in v1.1 so the
demo runbook DQL queries (`fetch bizevents ...`) work as written.

---

## 9. Dynatrace Trial Expiry

The 15-day free trial may expire before the June 11 deadline.
- A trial started on **May 18** expires around **June 2** — nine days before submission.
- Start a **fresh trial on May 27** to ensure coverage through June 11.
- Alternatively, request an extended trial from your Dynatrace contact.
- The GCP $100 credit request covers GCP costs; Dynatrace trial costs are separate.
