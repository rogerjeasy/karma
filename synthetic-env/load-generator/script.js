/**
 * k6 load generator for the Karma demo synthetic environment.
 *
 * Traffic pattern:
 *   - 50 RPS sustained to the active payments service
 *   - 3% of requests use a repeated Idempotency-Key (exercises error semantics contract)
 *   - Every 60s, also hits svc-reporting to keep downstream metrics populated
 *
 * Usage:
 *   k6 run --env PAYMENTS_URL=http://svc-payments-v2:8080 script.js
 *   k6 run --env PAYMENTS_URL=http://svc-payments-v3:8080 script.js  # post-cutover
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("error_rate");

const PAYMENTS_URL = __ENV.PAYMENTS_URL || "http://localhost:8010";
const REPORTING_URL = __ENV.REPORTING_URL || "http://localhost:8012";

// Fixed idempotency keys used for the 3% duplicate traffic
const REPEATED_KEYS = [
  "idem-key-alpha-001",
  "idem-key-alpha-002",
  "idem-key-alpha-003",
];

export const options = {
  scenarios: {
    // Main payments traffic: 50 RPS
    payments: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "24h",
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    // Reporting traffic: 1 RPS (simulates dashboard polling)
    reporting: {
      executor: "constant-arrival-rate",
      rate: 1,
      timeUnit: "1s",
      duration: "24h",
      preAllocatedVUs: 2,
      maxVUs: 5,
    },
  },
  thresholds: {
    error_rate: ["rate<0.05"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  // 3% of requests use repeated idempotency keys
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

  const ok = check(res, {
    "status is 200 or 409": (r) => r.status === 200 || r.status === 409,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);
}

export function reportingScenario() {
  const res = http.get(`${REPORTING_URL}/dashboard/charges-summary`);
  check(res, {
    "reporting 200": (r) => r.status === 200,
  });
}
