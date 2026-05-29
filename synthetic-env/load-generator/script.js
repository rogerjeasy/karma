/**
 * k6 load generator for the Karma demo synthetic environment.
 *
 * Post-cutover steady state (the live regression):
 *   - PAYMENTS_URL drives the ACTIVE replacement service (svc-payments-v3) at ~50 RPS.
 *     3% of requests reuse a fixed Idempotency-Key, exercising the error-semantics
 *     contract (v3 returns 409 WITHOUT `original_txn_id`).
 *   - REPORTING_URL polls svc-reporting at ~1 RPS. With v2 idle, the Redis summary
 *     key (recent_charges:summary) has expired, so every poll is a cache miss →
 *     svc-reporting falls back to a synchronous payments call (+550ms) → p95 ~600ms.
 *
 * IMPORTANT (shared-Redis topology): svc-payments-v2 warms the cache from a
 * background loop whenever it has a live instance — independent of traffic. So to
 * keep the regression VISIBLE, v2 must stay idle (no load). Driving v2 keeps the
 * cache warm and hides the downstream degradation. This generator therefore drives
 * v3 + reporting only.
 *
 * Two scenarios are wired to distinct exec functions (the previous version left the
 * reporting scenario without `exec`, so it silently re-ran the payments function and
 * svc-reporting received zero traffic).
 *
 * Usage (local):
 *   k6 run --env PAYMENTS_URL=http://localhost:8011 \
 *          --env REPORTING_URL=http://localhost:8012 script.js
 *
 * Tunable via env: PAYMENTS_URL, REPORTING_URL, DURATION, PAYMENTS_RATE, REPORTING_RATE
 */
import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("error_rate");

// PAYMENTS_URL = the active replacement (v3) post-cutover.
const PAYMENTS_URL = __ENV.PAYMENTS_URL || "http://localhost:8011";
const REPORTING_URL = __ENV.REPORTING_URL || "http://localhost:8012";
const DURATION = __ENV.DURATION || "24h";
const PAYMENTS_RATE = parseInt(__ENV.PAYMENTS_RATE || "50", 10);
const REPORTING_RATE = parseInt(__ENV.REPORTING_RATE || "1", 10);

// Fixed idempotency keys used for the 3% duplicate traffic (exercises 409 path)
const REPEATED_KEYS = [
  "idem-key-alpha-001",
  "idem-key-alpha-002",
  "idem-key-alpha-003",
];

export const options = {
  scenarios: {
    // Main payments traffic against the active replacement service.
    payments: {
      executor: "constant-arrival-rate",
      exec: "paymentsScenario",
      rate: PAYMENTS_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 30,
      maxVUs: 80,
    },
    // Downstream dashboard polling — degrades on cache miss (the slow fallback path).
    // Each request can take ~600ms, so allocate enough VUs to sustain the rate.
    reporting: {
      executor: "constant-arrival-rate",
      exec: "reportingScenario",
      rate: REPORTING_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 40,
    },
  },
  // No latency threshold here on purpose: the reporting fallback is ~600ms BY DESIGN.
  // A p95<500 threshold would breach and make k6 exit non-zero, marking the Cloud Run
  // job execution as Failed every run. We only track an error_rate gauge for signal.
};

export function paymentsScenario() {
  // 3% of requests use repeated idempotency keys → triggers the 409 duplicate path
  const useRepeatKey = Math.random() < 0.03;
  const idempotencyKey = useRepeatKey
    ? REPEATED_KEYS[Math.floor(Math.random() * REPEATED_KEYS.length)]
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const payload = JSON.stringify({
    amount: parseFloat((Math.random() * 500 + 1).toFixed(2)),
    currency: "USD",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
  };

  const res = http.post(`${PAYMENTS_URL}/charge`, payload, params);

  // 200 (new charge) and 409 (duplicate) are both expected, healthy responses.
  const ok = check(res, {
    "status is 200 or 409": (r) => r.status === 200 || r.status === 409,
  });

  errorRate.add(!ok);
}

export function reportingScenario() {
  const res = http.get(`${REPORTING_URL}/dashboard/charges-summary`);
  check(res, {
    "reporting 200": (r) => r.status === 200,
  });
}
