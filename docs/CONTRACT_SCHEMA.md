# Contract Schema Reference

Karma represents every discovered implicit contract as a structured JSON object. This document is the canonical schema reference.

---

## The Eight Contract Categories

| Category | `category` value | What it captures |
|----------|-----------------|------------------|
| Latency | `latency` | p50/p95/p99 response-time bands per endpoint, per hour-of-day |
| Error Semantics | `error_semantics` | Status codes and exact payload shapes under specific conditions |
| Throughput | `throughput` | Sustained QPS bands; burst envelope; backpressure behavior |
| Side Effect | `side_effect` | Cache writes, log records, async work, pre-warmed connections |
| Timing | `timing` | Order of operations; gap between call and downstream observable effect |
| Dependency | `dependency` | Which downstream services are called, at what frequency, with what payloads |
| Resource | `resource` | Connection-pool usage, memory steady-state, file-descriptor counts |
| Sequencing | `sequencing` | Retry behavior, idempotency guarantees, ordering assumptions |

---

## Full JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/rogerjeasy/karma/agents/karma/prompts/contract_schema.json",
  "title": "ImplicitContract",
  "description": "A single implicit behavioral contract learned from a service's telemetry",
  "type": "object",
  "required": [
    "contract_id", "service_id", "category", "subcategory",
    "description", "evidence", "confidence",
    "detected_at", "learning_window", "violation_predicate"
  ],
  "properties": {
    "contract_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier generated at contract creation time"
    },
    "service_id": {
      "type": "string",
      "description": "Dynatrace entity ID of the service being observed (e.g. SERVICE-OLD-PAYMENTS-v2)"
    },
    "category": {
      "type": "string",
      "enum": ["latency", "error_semantics", "throughput", "side_effect", "timing", "dependency", "resource", "sequencing"]
    },
    "subcategory": {
      "type": "string",
      "description": "Fine-grained label within the category (e.g. 'cache_warming', 'idempotency_response')"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of the contract. Written as a factual observation, not a prescription."
    },
    "evidence": {
      "type": "array",
      "minItems": 1,
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["type", "dql", "sample_count", "timespan"],
            "properties": {
              "type": { "const": "dql_query" },
              "dql": { "type": "string", "description": "The exact DQL query used to derive this evidence" },
              "sample_count": { "type": "integer", "minimum": 1 },
              "timespan": { "type": "string", "description": "Human-readable time range, e.g. '14d'" },
              "result_summary": { "type": "string" }
            }
          },
          {
            "type": "object",
            "required": ["type", "pattern", "frequency", "sample_count"],
            "properties": {
              "type": { "const": "trace_pattern" },
              "pattern": { "type": "string", "description": "Trace span pattern, e.g. 'service.write -> redis.SET'" },
              "frequency": { "type": "string", "description": "Observed frequency, e.g. '32 ± 4 per minute'" },
              "sample_count": { "type": "integer", "minimum": 1 }
            }
          }
        ]
      }
    },
    "downstream_dependents": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Dynatrace entity IDs of services that depend on this contract"
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Gemini's confidence in the contract based on evidence volume and consistency"
    },
    "detected_at": {
      "type": "string",
      "format": "date-time"
    },
    "learning_window": {
      "type": "object",
      "required": ["start", "end"],
      "properties": {
        "start": { "type": "string", "format": "date-time" },
        "end":   { "type": "string", "format": "date-time" }
      }
    },
    "violation_predicate": {
      "type": "object",
      "required": ["type", "test_dql", "threshold", "tolerance_window_seconds"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["absence", "threshold_breach", "distribution_shift", "pattern_mismatch"]
        },
        "test_dql": {
          "type": "string",
          "description": "DQL query evaluated against the NEW service. A predicate failure triggers a ghost report."
        },
        "threshold": {
          "type": "string",
          "description": "Human-readable threshold expression, e.g. 'count >= 20 over any 5-minute window'"
        },
        "tolerance_window_seconds": {
          "type": "integer",
          "minimum": 60,
          "description": "How long a predicate failure must persist before triggering Forensic"
        }
      }
    },
    "validated": {
      "type": "boolean",
      "description": "True only after the validator runs the predicate against OLD service history with zero false positives"
    },
    "false_positive_count": {
      "type": "integer",
      "minimum": 0
    },
    "validation_run_count": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

---

## Worked Example — The Cache-Warming Contract

```json
{
  "contract_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "service_id": "SERVICE-SVC-PAYMENTS-V2",
  "category": "side_effect",
  "subcategory": "cache_warming",
  "description": "Service writes a sliding-window summary to redis://prod-cache/recent_charges:summary every ~30s during normal operation. Downstream svc-reporting reads these keys directly without calling the API.",
  "evidence": [
    {
      "type": "dql_query",
      "dql": "fetch logs | filter service.name == \"svc-payments-v2\" and content contains \"redis.SET\" | summarize count(), by: bin(timestamp, 30s)",
      "sample_count": 14000,
      "timespan": "14d",
      "result_summary": "~2 writes per 30s window, consistent across 14-day window"
    },
    {
      "type": "trace_pattern",
      "pattern": "svc-payments-v2 -> redis.SET recent_charges:summary",
      "frequency": "2 ± 0.3 per 30 seconds",
      "sample_count": 28000
    }
  ],
  "downstream_dependents": ["SERVICE-SVC-REPORTING"],
  "confidence": 0.95,
  "detected_at": "2026-05-26T14:00:00Z",
  "learning_window": {
    "start": "2026-05-12T00:00:00Z",
    "end": "2026-05-26T00:00:00Z"
  },
  "violation_predicate": {
    "type": "absence",
    "test_dql": "fetch logs | filter service.name == \"svc-payments-v3\" and content contains \"redis.SET\" and content contains \"recent_charges\" | summarize count()",
    "threshold": "count >= 1 over any 5-minute window",
    "tolerance_window_seconds": 300
  },
  "validated": true,
  "false_positive_count": 0,
  "validation_run_count": 1
}
```

---

## Validation Rule

A contract is accepted into Memory Bank **only if** its `violation_predicate.test_dql` fires **zero false positives** when run against the *old* service's historical telemetry.

This rule eliminates noisy predicates before they ever reach the Watcher.
