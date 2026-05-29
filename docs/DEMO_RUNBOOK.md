# Demo Runbook — Reproducing the Karma Demo End-to-End

This runbook lets a judge (or teammate) reproduce the full demo without assistance. Every step is explicit. Expected duration: ~25 minutes from cold start.

---

## Prerequisites

- Google Cloud project `skillbridge-76a4c` with all services deployed (see deployment section in README)
- Dynatrace tenant with telemetry flowing from the synthetic environment
- Access to the hosted dashboard at `https://karma.<domain>`

---

## Quick-Start (Admin Panel Demo Seed)

For the fastest path to a working demo state, use the **Admin Panel → Infrastructure** tab:

1. Sign in with a Google account that has the `admin` role
2. Navigate to **Dashboard → Admin**
3. On the **Infrastructure** tab, find the **Demo Quick-Start** panel
4. Click **Seed Demo Data** — this calls `POST /demo/seed` which pre-populates Firestore with:
   - `svc-payments-v2 [demo]` in `haunting` phase
   - 4 validated contracts (cache warming, latency, dependency, error semantics)
   - 1 ghost report for the cache-warming violation
   - 1 deployment metric record
5. Navigate to **Dashboard → Services** to see the seeded service
6. Navigate to **Dashboard → Ghosts** to see the ghost report

To reset: click **Reset Demo** in the same panel, or call `DELETE /demo/reset`.

---

## Full Manual Walkthrough

Use this path to reproduce the end-to-end agent flow (learning + watching + forensic).

---

## Step 0 — Verify the synthetic environment is healthy

```bash
# All three services should return 200
curl https://karma-svc-payments-v2-<hash>-uc.a.run.app/health
curl https://karma-svc-payments-v3-<hash>-uc.a.run.app/health
curl https://karma-svc-reporting-<hash>-uc.a.run.app/health

# Load generator should be running (check Cloud Scheduler)
gcloud scheduler jobs list --location us-central1
```

Expected: all health endpoints return `{"status": "ok", "service": "<name>"}`.

If the load generator has not been running, start it manually:

```bash
gcloud scheduler jobs run karma-load-generator --location us-central1
```

Wait 15 minutes for sufficient telemetry before proceeding.

---

## Step 1 — Reset to a clean demo state

```bash
./scripts/reset-demo.sh
```

This script:
1. Deletes all Firestore documents in `services`, `contracts`, `violations`, `ghost_reports`
2. Clears Karma's Memory Bank for the demo tenant
3. Confirms reset with a summary

Alternatively, use the API:
```bash
curl -X DELETE https://api.karma.<domain>/demo/reset \
  -H "Authorization: Bearer <firebase-id-token>"
```

---

## Step 2 — Register svc-payments-v2 for deprecation

1. Open the dashboard: `https://karma.<domain>`
2. Sign in with Google (your judge account)
3. Click **"Register service"**
4. Fill in:
   - **Service name:** `svc-payments-v2`
   - **Dynatrace entity:** `SERVICE-SVC-PAYMENTS-V2` (auto-found via search)
   - **Deprecation date:** today + 14 days
5. Click **"Register and begin learning"**

The dashboard transitions to *Learning mode* — you'll see a spinner and the Learner agent status.

---

## Step 3 — Run the Learner (pre-baked state)

For the live demo, the Learner has already processed 14 days of telemetry. To use the pre-baked state:

```bash
./scripts/seed-demo-data.sh
```

This populates Firestore and Memory Bank with the golden-run contracts.

Alternatively, to run the Learner live (takes 3–5 minutes):

1. On the dashboard, click **"Run learning pass now"**
2. Watch the contract discovery log panel — contracts appear one by one
3. When the Learner finishes, you'll see 4–6 contracts in the timeline

To re-trigger learning via API:

```bash
curl -X POST https://api.karma.<domain>/services/<service_id>/learn \
  -H "Authorization: Bearer <token>"
```

---

## Step 4 — Inspect the discovered contracts

On the **Contract Timeline** view, you should see (at minimum):

| # | Category | Subcategory | Confidence |
|---|----------|-------------|------------|
| 1 | `latency` | `p95_endpoint_band` | ≥ 0.90 |
| 2 | `error_semantics` | `idempotency_response` | ≥ 0.88 |
| 3 | `throughput` | `sustained_qps` | ≥ 0.85 |
| **4** | **`side_effect`** | **`cache_warming`** | **≥ 0.93** |

Click contract #4 to expand it. The description should read:

> *"Service writes a sliding-window summary to recent_charges:summary in Redis every ~30s. Downstream svc-reporting reads these keys directly without calling the API."*

### 4a — Verify the Dynatrace SLOs created from contracts

The Learner automatically registered contracts #1, #2, and #3 as Dynatrace SLOs.
Verify in Dynatrace → **Observe & Explore → SLOs**:

```dql
// In a Dynatrace Grail Notebook:
fetch slo
| filter customInfo contains "karma-contract"
| fields name, target, status, errorBudget, customInfo
| sort name asc
```

You should see three SLOs:
- `karma/svc-payments-v2/latency/p95_endpoint_band` — 95% target
- `karma/svc-payments-v2/throughput/sustained_qps` — 95% target
- `karma/svc-payments-v2/error-rate/idempotency_response` — 95% target

These are live Dynatrace SLOs. If a judge looks at the Dynatrace SLO dashboard, they can see Karma's discovered contracts enforced as first-class SLOs.

### 4b — Verify BizEvents

```dql
fetch bizevents
| filter event.type == "karma.learning.complete"
| fields timestamp, event.data.service_id, event.data.contracts_discovered, event.data.contracts_validated
| sort timestamp desc
| limit 5
```

If contract #4 is missing, re-run the Learner with the cache-warming hint:

```bash
curl -X POST https://api.karma.<domain>/services/<service_id>/learn \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"hint": "pay attention to async writes to external stores (Redis, queues)"}'
```

---

## Step 5 — Trigger cutover

1. On the dashboard, click **"Mark cutover"** next to `svc-payments-v2`
2. In the dialog, set:
   - **Replacement service:** `svc-payments-v3`
   - **Cutover time:** now
3. Click **"Confirm cutover"**

The dashboard transitions to *Haunting mode*. The Watcher is now active.

---

## Step 6 — Observe the ghost detection

The Watcher runs every 10 minutes via Cloud Scheduler → `POST /pubsub/watcher-tick`.

To trigger it immediately via the Admin Panel:

1. Go to **Dashboard → Admin → Infrastructure**
2. Find the system service for `svc-payments-v3`
3. Click the Watcher run button

Or trigger via API (requires admin token):

```bash
curl -X POST https://api.karma.<domain>/pubsub/watcher-tick \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"service_id": "<service_id>"}'
```

Within 30–60 seconds, the dashboard should show:

```
Ghost detected — svc-payments-v3

Contract #4 violated: side_effect / cache_warming
Redis writes absent.
Downstream impact: svc-reporting p95 latency +540ms, throughput −7.8%
```

A second violation should follow:

```
Contract #2 violated: error_semantics / idempotency_response
409 body missing field `original_txn_id`
```

---

## Step 7 — Inspect a ghost report

Click on the ghost report for contract #4. You should see:

- **Summary:** natural-language description of the violation
- **Root cause:** "svc-payments-v3 does not implement the Redis cache-warming background task present in v2"
- **Downstream impact:** live svc-reporting metrics showing the p95 latency increase
- **Evidence links:** clickable DQL queries that open in Dynatrace
- **Davis AI insights:** remediation guidance from `ask-dynatrace-docs`
- **Investigation cost:** token count + USD estimate from `get_session_cost_estimate`
- **Avoided incident cost:** estimated savings from early detection
- **Dynatrace Notebook link:** opens the investigation notebook created by Forensic (for CRITICAL reports)
- **Dynatrace BizEvent:** verify the `karma.ghost_report.created` audit record:
  ```dql
  fetch bizevents
  | filter event.type == "karma.ghost_report.created"
  | fields timestamp, event.data.title, event.data.severity, event.data.report_id
  | sort timestamp desc
  | limit 5
  ```
- **Dynatrace service annotation:** the `push_ghost_report_to_dynatrace` event — visible on the svc-payments-v3 service detail page under "Events"
- **SLO burn rate:** the latency SLO should show increased burn rate since cutover — visible in **Observe & Explore → SLOs**

---

## Step 8 — Migration Readiness Score

Navigate to **Dashboard → Services → svc-payments-v3** to see the Migration Readiness Score panel:

- **Overall score:** weighted 0–100 across all contract categories
- **Category breakdown:** per-category compliance status
- **Avoided incident cost:** total estimated savings across all ghost reports

A score below 80 shows a banner: "Unresolved violations — address before cutting over."

---

## Step 9 — Admin — Coding Agent Observability

Navigate to **Dashboard → Admin → Coding Agents** to see the agent token/cost comparison:

- **Karma ADK agents** (Gemini 2.5 Pro) — total tokens + cost for the entire Learner/Watcher/Forensic system
- **Claude Code dev sessions** (Claude Sonnet 4.6) — tokens from the development sessions that built this system
- Both powered by live DQL against `fetch spans` in Grail (falls back to Firestore when `DT_QUERY_TOKEN` is not set)

---

## Step 10 — Reset for next judge

```bash
./scripts/reset-demo.sh
```

Or via Admin Panel → Infrastructure → Reset Demo.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Contract #4 not discovered | Re-run Learner with cache-warming hint (Step 4b) |
| Ghost not detected | Confirm load generator is running; trigger watcher manually (Step 6) |
| Dashboard shows auth error | Firebase Auth — sign out and sign back in |
| SSE events not streaming | Refresh the page; check Cloud Run logs for the API service |
| Firestore permission denied | Verify Firebase Auth token is valid; check Firestore rules |
| Slack notification not sent | Check Dynatrace Slack Connector is configured (optional feature) |
| Dynatrace Notebook not created | Check Platform Token has `document:documents:write` scope |
| Agent observability shows $0 | Set `DT_QUERY_TOKEN` env var; Firestore fallback shows only ghost report costs |

---

## Golden Run Snapshot

If the live environment is unavailable, restore from the golden run snapshot:

```bash
./scripts/golden-run-snapshot.sh restore
```

This loads a pre-captured Firestore state that reflects a complete successful demo run. Alternatively, use the Admin Panel → Demo Quick-Start → Seed Demo Data for an instant seeded state.

---

## Believability: Learn a Contract on a REAL Service (Dogfood)

The synthetic environment proves the *mechanism*. To prove Karma isn't hard-wired to
a scripted scenario, point the **same Learner** at one of Karma's own deployed
services — `karma-api` — which emits real OpenTelemetry to the same Dynatrace tenant.
Karma then discovers a contract from genuine production telemetry.

**1. Register Karma's own API as a self-monitored (system) service:**

```bash
# Resolves the real Dynatrace entity ID by name and registers it (idempotent).
# Requires DT_ENV + DT_QUERY_TOKEN in .env and ADC (gcloud auth application-default login).
python3 scripts/dogfood_register.py \
  --service-name "Karma API" \
  --entity-name  "karma-api" \
  --url          "https://karma-api-ucvx5uwt5q-uc.a.run.app"

# If auto-resolution can't find it, pass the entity ID explicitly
# (Dynatrace -> Services -> karma-api -> the SERVICE-... value in the URL):
#   --entity-id "SERVICE-XXXXXXXXXXXXXXXX"
```

**2. Trigger the Learner** (one click in **Admin -> Infrastructure -> Karma API -> Learn**,
or add `--api-url <API_URL> --admin-token <firebase-id-token>` to the command above to
trigger it automatically).

**3. Verify the proof is public.** Once contracts are saved, they appear on the
**public landing page** under *"Live Proof - learned from Karma's own production API"*
and via `GET /proof/live` - no login required, so a judge sees a contract discovered
from real telemetry, side-by-side with the demo. Each contract shows the real DQL used
as evidence; run it yourself in a Dynatrace Notebook to confirm the data is live.

> The learning window defaults to 14 days. If `karma-api` is newly deployed and has
> little history, lower the window or generate traffic first; the Learner needs enough
> real spans to find a high-confidence contract.
