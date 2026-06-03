/**
 * k6 load generator for the Karma demo synthetic environment.
 *
 * Post-cutover steady state (the live regression):
 *   - PAYMENTS_URL drives the ACTIVE replacement service (svc-payments-v3) with a
 *     realistic endpoint MIX (not just /charge), so the Learner/Watcher see real
 *     per-endpoint latency bands, a dependency fan-out, refunds, and read paths:
 *       ~80% POST /charge        (3% reuse a fixed Idempotency-Key → 409 path;
 *                                 ~3% are malformed → 400/422 error-semantics)
 *       ~10% GET  /charges       (list read path)
 *       ~ 6% GET  /charge/{id}   (status lookup — uses a captured txn_id)
 *       ~ 4% POST /refund        (ledger + audit side effects — captured txn_id)
 *   - REPORTING_URL polls svc-reporting at ~1 RPS, alternating its two widgets.
 *     With v2 idle, the Redis summary key (recent_charges:summary) has expired, so
 *     every poll is a cache miss → synchronous fallback (+550ms) → p95 ~600ms.
 *
 * IMPORTANT (shared-Redis topology): svc-payments-v2 warms the cache from a
 * background loop whenever it has a live instance — independent of traffic. So to
 * keep the regression VISIBLE, v2 must stay idle (no load). Driving v2 keeps the
 * cache warm and hides the downstream degradation. This generator therefore drives
 * v3 + reporting only. (Use simulate_traffic.py for the v2 LEARNING burst.)
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
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"];

// Per-VU ring buffer of recently created txn_ids, so /charge/{id} and /refund
// operate on charges that actually exist (no synthetic 404 noise).
let recentTxns = [];
function rememberTxn(id) {
  if (!id) return;
  recentTxns.push(id);
  if (recentTxns.length > 50) recentTxns.shift();
}
function pickTxn() {
  if (recentTxns.length === 0) return null;
  return recentTxns[Math.floor(Math.random() * recentTxns.length)];
}

export const options = {
  scenarios: {
    payments: {
      executor: "constant-arrival-rate",
      exec: "paymentsScenario",
      rate: PAYMENTS_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 40,
      maxVUs: 100,
    },
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
  // No latency threshold on purpose: the reporting fallback is ~600ms BY DESIGN.
};

function postCharge() {
  const useRepeatKey = Math.random() < 0.03;
  const idempotencyKey = useRepeatKey
    ? REPEATED_KEYS[Math.floor(Math.random() * REPEATED_KEYS.length)]
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // ~3% malformed to exercise 400 (bad amount) / 422 (bad currency).
  const roll = Math.random();
  let body;
  if (roll < 0.015) {
    body = { amount: -5, currency: "USD" };
  } else if (roll < 0.03) {
    body = { amount: 12.5, currency: "XYZ" };
  } else {
    body = {
      amount: parseFloat((Math.random() * 500 + 1).toFixed(2)),
      currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
    };
  }

  const params = {
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    responseType: "text", // retain body so we can capture txn_id (global discard is on)
  };
  const res = http.post(`${PAYMENTS_URL}/charge`, JSON.stringify(body), params);

  // 200 (new), 409 (dup), 400/422 (intentional bad input), 402 (declined) are all expected.
  const ok = check(res, {
    "charge expected status": (r) => [200, 400, 402, 409, 422].includes(r.status),
  });
  if (res.status === 200) {
    try {
      rememberTxn(JSON.parse(res.body).txn_id);
    } catch (e) {
      // ignore parse errors
    }
  }
  errorRate.add(!ok);
}

export function paymentsScenario() {
  const r = Math.random();
  if (r < 0.8) {
    postCharge();
  } else if (r < 0.9) {
    const res = http.get(`${PAYMENTS_URL}/charges?limit=20`);
    errorRate.add(!check(res, { "charges 200": (x) => x.status === 200 }));
  } else if (r < 0.96) {
    const id = pickTxn();
    if (id) {
      const res = http.get(`${PAYMENTS_URL}/charge/${id}`);
      errorRate.add(!check(res, { "lookup 200/404": (x) => x.status === 200 || x.status === 404 }));
    } else {
      postCharge();
    }
  } else {
    const id = pickTxn();
    if (id) {
      const res = http.post(`${PAYMENTS_URL}/refund`, JSON.stringify({ txn_id: id }), {
        headers: { "Content-Type": "application/json" },
      });
      errorRate.add(!check(res, { "refund 200/404": (x) => x.status === 200 || x.status === 404 }));
    } else {
      postCharge();
    }
  }
}

export function reportingScenario() {
  // Alternate the two widgets; both depend on the same cache key.
  const path = Math.random() < 0.5 ? "/dashboard/charges-summary" : "/dashboard/top-merchants";
  const res = http.get(`${REPORTING_URL}${path}`);
  check(res, { "reporting 200": (r) => r.status === 200 });
}
