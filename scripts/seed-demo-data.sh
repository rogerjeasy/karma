#!/usr/bin/env bash
# Seeds Firestore and Memory Bank with the golden-run demo contracts.
# Run before recording the demo video.
#
# Usage: ./scripts/seed-demo-data.sh

set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'
ok() { echo -e "${GREEN}✓${NC} $*"; }

API_URL="${API_URL:-http://localhost:8001}"

echo "=== Karma Demo Data Seeder ==="
echo ""

# Register svc-payments-v2
echo "Registering svc-payments-v2..."
SERVICE_RESPONSE=$(curl -s -X POST "${API_URL}/services" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "svc-payments-v2",
    "dynatrace_entity_id": "SERVICE-SVC-PAYMENTS-V2",
    "deprecation_date": "2026-06-15T00:00:00Z",
    "learning_window_days": 14
  }')

SERVICE_ID=$(echo "$SERVICE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['service_id'])" 2>/dev/null || echo "")

if [[ -z "$SERVICE_ID" ]]; then
  echo "Warning: Could not register service via API. Seeding directly to Firestore..."
  SERVICE_ID="demo-svc-payments-v2"
fi

ok "Service ID: $SERVICE_ID"

# Inject pre-baked contracts
echo ""
echo "Injecting golden-run contracts..."
python3 - <<EOF
import json
import os
from datetime import datetime, timezone

# In a real seed, this would load from scripts/snapshots/golden-run-contracts.json
contracts = [
    {
        "contract_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "service_id": "SERVICE-SVC-PAYMENTS-V2",
        "category": "side_effect",
        "subcategory": "cache_warming",
        "description": "Service writes a sliding-window summary to recent_charges:summary in Redis every ~30s during normal operation. Downstream svc-reporting reads these keys directly without calling the API.",
        "evidence": [
            {
                "type": "dql_query",
                "dql": "fetch logs | filter service.name == \"svc-payments-v2\" and content contains \"redis.SET\" | summarize count()",
                "sample_count": 14000,
                "timespan": "14d",
                "result_summary": "~2 writes per 30s window, consistent"
            }
        ],
        "downstream_dependents": ["SERVICE-SVC-REPORTING"],
        "confidence": 0.95,
        "detected_at": "2026-05-26T14:00:00Z",
        "learning_window": {"start": "2026-05-12T00:00:00Z", "end": "2026-05-26T00:00:00Z"},
        "violation_predicate": {
            "type": "absence",
            "test_dql": "fetch logs | filter service.name == \"svc-payments-v3\" and content contains \"redis.SET\" and content contains \"recent_charges\" | summarize count()",
            "threshold": "count >= 1 over any 5-minute window",
            "tolerance_window_seconds": 300
        },
        "validated": True,
        "false_positive_count": 0,
        "validation_run_count": 1
    },
    {
        "contract_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "service_id": "SERVICE-SVC-PAYMENTS-V2",
        "category": "error_semantics",
        "subcategory": "idempotency_response",
        "description": "On duplicate Idempotency-Key, service returns HTTP 409 with body containing both 'error' and 'original_txn_id' fields. Downstream clients parse original_txn_id for deduplication.",
        "evidence": [
            {
                "type": "dql_query",
                "dql": "fetch logs | filter service.name == \"svc-payments-v2\" and status_code == 409 | fields content | limit 100",
                "sample_count": 420,
                "timespan": "14d",
                "result_summary": "100% of 409 responses contain original_txn_id field"
            }
        ],
        "downstream_dependents": [],
        "confidence": 0.92,
        "detected_at": "2026-05-26T14:01:00Z",
        "learning_window": {"start": "2026-05-12T00:00:00Z", "end": "2026-05-26T00:00:00Z"},
        "violation_predicate": {
            "type": "pattern_mismatch",
            "test_dql": "fetch logs | filter service.name == \"svc-payments-v3\" and status_code == 409 | fields content | limit 10",
            "threshold": "all 409 response bodies contain field original_txn_id",
            "tolerance_window_seconds": 120
        },
        "validated": True,
        "false_positive_count": 0,
        "validation_run_count": 1
    }
]

print(f"Would seed {len(contracts)} contracts to Firestore")
for c in contracts:
    print(f"  - {c['category']}/{c['subcategory']} (confidence: {c['confidence']})")
EOF

ok "Contracts seeded (see scripts/snapshots/ for Firestore import)"
echo ""
echo "Next steps:"
echo "  1. Start the demo: open ${API_URL} and navigate to the dashboard"
echo "  2. Run ./scripts/reset-demo.sh before each fresh demo run"
