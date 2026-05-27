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

**Troubleshooting Agent** (`find-troubleshooting-guides`):
```
davis-copilot:document-search:execute
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

The table below shows the **confirmed MCP tool names** from the live `tools/list` response.
Use the exact `name` values in agent code — these use hyphens, not underscores.

| MCP `name` | Karma wrapper function | What it does | Key scope(s) |
|---|---|---|---|
| `create-dql` | — | Generate DQL from natural language (does not execute) | `davis-copilot:nl2dql:execute` |
| `execute-dql` | `execute_dql` (direct HTTP) | Execute DQL, return raw results (max 1 000 records) | `storage:buckets:read` + data permissions |
| `explain-dql` | — | Explain a DQL query in natural language | `davis-copilot:dql2nl:execute` |
| `ask-dynatrace-docs` | `ask_dynatrace_docs_via_mcp` | Answer Dynatrace product questions; remediation guidance | `davis-copilot:conversations:execute` |
| `find-troubleshooting-guides` | `find_troubleshooting_guides_via_mcp` | Find troubleshooting guide Notebooks | `davis-copilot:document-search:execute` |
| `query-problems` | `query_problems_via_mcp` | AI-enriched root cause for a service (Davis Root Cause Agent) | `storage:buckets:read`, `storage:events:read` |
| `list-problems` | `list_problems_via_mcp` | List all Davis problems; cross-correlate violations | `storage:buckets:read`, `storage:events:read` |
| `get-problem-by-id` | `get_problem_details_via_mcp` | Full details of a specific Davis problem | `storage:buckets:read`, `storage:events:read` |
| `get-vulnerabilities` | — | List active security vulnerabilities | `storage:buckets:read`, `storage:security.events:read` |
| `get-events-for-kubernetes-cluster` | — | K8s events for all clusters or a specific one | `storage:buckets:read`, `storage:events:read` |
| `timeseries-forecast` | — | Predict future timeseries values | `storage:buckets:read`, `davis:analyzers:*` |
| `timeseries-novelty-detection` | `detect_changepoints_via_mcp` | Find outliers, level changes, and trends | `storage:buckets:read`, `davis:analyzers:*` |
| `adaptive-anomaly-detector` | `adaptive_anomaly_detection_via_mcp` | Anomaly detection with learned adaptive threshold | `storage:buckets:read`, `davis:analyzers:*` |
| `seasonal-baseline-anomaly-detector` | — | Anomaly detection accounting for seasonal patterns | `storage:buckets:read`, `davis:analyzers:*` |
| `static-threshold-analyzer` | — | Anomaly detection against a fixed threshold | `storage:buckets:read`, `davis:analyzers:*` |
| `find-documents` | — | Search Dashboards and Notebooks by title | `document:documents:read` |
| `get-entity-id` | `get_entity_id_via_mcp` | Resolve entity name + type → Dynatrace entity ID | `storage:entities:read` |
| `get-entity-name` | `get_entity_name_via_mcp` | Resolve Dynatrace entity ID → human-readable name | `storage:entities:read` |
| `send-event` | `send_event_via_mcp` | Post a custom event to a Dynatrace entity timeline | `storage:events:write` (platform scope) |
| `send-slack-message` | `send_slack_message_via_mcp` | Send a Slack message via the DT Slack Connector | Slack Connector must be configured in DT |
| `send-email` | `send_email_via_mcp` | Send an email via the Dynatrace Email API | Email connector must be configured in DT |
| `create-dynatrace-notebook` | `create_dynatrace_notebook_via_mcp` | Create a collaborative Dynatrace Notebook | `document:documents:write` |
| `create-workflow-for-notification` | `create_workflow_for_notification_via_mcp` | Create a Dynatrace Workflow for recurring alerts | `automation:workflows:write` |

> **Notes:**
> - `execute_dql` is called via direct HTTP to the Grail API, not through the MCP gateway, to avoid anyio cancel scope issues in Agent Engine.
> - `send-slack-message` and `send-email` require the respective Dynatrace connectors to be configured in your tenant. If not configured, Karma logs the error and continues.
> - `create-dynatrace-notebook` requires `document:documents:write` scope on the Platform Token.

---

## 6. Configure OpenTelemetry Ingest

The synthetic environment services and the Karma API export OTel traces and logs to your Dynatrace tenant.

### OTel endpoint
```
https://<environment-name>.live.dynatrace.com/api/v2/otlp
```

### Authentication header
```
Authorization: Api-Token <your-otel-api-token>
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

Only `DT_ENV` and `DT_API_TOKEN` are required for the agent system. All Dynatrace URLs are derived by the agent code from `DT_ENV`.

```bash
# Required for agents (MCP gateway)
DT_ENV=<your-environment-name>
DT_API_TOKEN=<your-platform-token>

# Optional — leave blank; derived from DT_ENV automatically
# Set only if you need a local stdio override
DT_MCP_URL=

# Classic API token for OTel, BizEvents, SLO, and Events ingest
# Required scopes: openTelemetryTrace.ingest, logs.ingest, metrics.ingest,
#                  events.ingest, bizevents.ingest, slo.write
DT_OTEL_TOKEN=<your-otel-classic-token>

# Classic API token for Grail DQL read (agent observability panel)
# Required scopes: storage:spans:read (or storage:buckets:read)
DT_QUERY_TOKEN=<your-query-classic-token>
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
| `settings.dt_events_endpoint` | `<dt_classic_base_url>/api/v2/events/ingest` |
| `settings.dt_otel_endpoint` | `<dt_classic_base_url>/api/v2/otlp` |

---

## 8. BizEvents Ingest (Karma Self-Observability)

Karma calls the **BizEvents Ingest API v2** directly to emit every agent decision as a structured CloudEvent, visible as business-process telemetry in Dynatrace Grail.

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
This is a classic API scope — available on Dynatrace free trials.

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

Karma emits events under these types (defined in `agents/karma/tools/dynatrace_events.py`):

| Event type (`event.type`) | Emitted by | When |
|---|---|---|
| `karma.learning.started` | Learner | After resolving the service entity ID |
| `karma.contract.discovered` | Learner | After each validated contract |
| `karma.contract.rejected` | Learner | When a contract fails validation |
| `karma.learning.complete` | Learner | After all contracts are saved |
| `karma.violation.detected` | Watcher (via Forensic) | When a predicate fails |
| `karma.ghost_report.created` | Forensic | After producing a ghost report |

---

## 9. Dynatrace Service Timeline Annotations

In addition to BizEvents, the Forensic agent writes `CUSTOM_ANNOTATION` events directly onto the Dynatrace service entity timeline via `push_ghost_report_to_dynatrace`. These are visible under the service's **Events** tab in Dynatrace and can trigger Davis AI correlation.

**Endpoint:** `settings.dt_events_endpoint` → `POST /api/v2/events/ingest`  
**Required scope:** `events.ingest`

---

## 10. Dynatrace Trial Expiry

The 15-day free trial may expire before the June 11 deadline.
- A trial started on **May 18** expires around **June 2** — nine days before submission.
- Start a **fresh trial on May 27** to ensure coverage through June 11.
- Alternatively, request an extended trial from your Dynatrace contact.
- The GCP $100 credit request covers GCP costs; Dynatrace trial costs are separate.

---

## 11. Slack Connector Setup (Optional)

The `send_slack_message_via_mcp` tool requires the Dynatrace Slack Connector to be configured in your tenant.

1. In Dynatrace → **Apps → Slack** (or search for Slack in the Apps marketplace)
2. Connect your Slack workspace and authorize the `dynatrace` app
3. Note the channel name format: `#channel-name` (with hash, in lowercase)

If the connector is not configured, `send_slack_message_via_mcp` returns an error and the Forensic agent logs it and continues. Slack notifications are optional — ghost reports are always saved to Firestore regardless.
