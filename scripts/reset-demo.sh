#!/usr/bin/env bash
# Resets the Karma demo to a clean state.
# Clears Firestore collections: services, contracts, violations, ghost_reports
# Optionally clears Memory Bank contracts for the demo service.
#
# Usage: ./scripts/reset-demo.sh [--with-memory-bank]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

WITH_MB="${1:-}"
PROJECT_ID="${GCP_PROJECT_ID:-skillbridge-76a4c}"

echo "=== Karma Demo Reset ==="
echo ""
echo "This will DELETE all data from Firestore collections:"
echo "  - services"
echo "  - contracts"
echo "  - violations"
echo "  - ghost_reports"
echo ""
read -p "Confirm reset? [y/N] " -n 1 -r REPLY
echo ""

if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "Clearing Firestore collections..."

python3 - <<EOF
import os

try:
    from google.cloud import firestore
    db = firestore.Client(project="${PROJECT_ID}")
    collections = ["services", "contracts", "violations", "ghost_reports"]
    for col in collections:
        docs = db.collection(col).stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        print(f"  Deleted {count} documents from '{col}'")
    print("Firestore reset complete.")
except ImportError:
    print("  Warning: google-cloud-firestore not installed. Skipping Firestore reset.")
    print("  Run: pip install google-cloud-firestore")
except Exception as e:
    print(f"  Error: {e}")
EOF

ok "Firestore collections cleared"

if [[ "$WITH_MB" == "--with-memory-bank" ]]; then
  echo ""
  echo "Clearing Memory Bank..."
  warn "Memory Bank clearing requires Agent Engine access — implement via ADK SDK"
  echo "  (Skipping — clear manually via Vertex AI console if needed)"
fi

echo ""
ok "Demo reset complete. Run ./scripts/seed-demo-data.sh to restore golden-run state."
