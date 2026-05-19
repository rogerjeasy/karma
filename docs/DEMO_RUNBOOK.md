# Demo Runbook — Reproducing the Karma Demo End-to-End

This runbook lets a judge (or teammate) reproduce the full demo without assistance. Every step is explicit. Expected duration: ~25 minutes from cold start.

---

## Prerequisites

- Google Cloud project `skillbridge-76a4c` with all services deployed (see deployment section in README)
- Dynatrace tenant with telemetry flowing from the synthetic environment
- Access to the hosted dashboard at `https://karma.<domain>`

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

If contract #4 is missing, run:

```bash
# Manually trigger the Learner with the cache-warming hint
curl -X POST https://api.karma.<domain>/services/svc-payments-v2/learn \
  -H "Authorization: Bearer <token>" \
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

The Watcher runs every 10 minutes. To trigger it immediately:

```bash
curl -X POST https://api.karma.<domain>/watchers/run-now \
  -H "Authorization: Bearer <token>"
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
- **Dynatrace BizEvent link:** the `emit_karma_event` audit record — verify in Dynatrace with DQL: `fetch bizevents | filter event.type == "karma.ghost_report.created" | sort timestamp desc | limit 5`

---

## Step 8 — Reset for next judge

```bash
./scripts/reset-demo.sh
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Contract #4 not discovered | Re-run Learner with cache-warming hint (Step 4) |
| Ghost not detected | Confirm load generator is running; wait one full Watcher cycle |
| Dashboard shows auth error | Firebase Auth — sign out and sign back in |
| SSE events not streaming | Refresh the page; check Cloud Run logs for the API service |
| Firestore permission denied | Verify Firebase Auth token is valid; check Firestore rules |

---

## Golden Run Snapshot

If the live environment is unavailable, restore from the golden run snapshot:

```bash
./scripts/golden-run-snapshot.sh restore
```

This loads a pre-captured Firestore state that reflects a complete successful demo run.
