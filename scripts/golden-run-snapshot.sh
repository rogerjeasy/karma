#!/usr/bin/env bash
# Captures or restores a golden-run snapshot of Firestore state.
# Use to create a "known good" demo state that can be restored before recording.
#
# Usage:
#   ./scripts/golden-run-snapshot.sh capture   — saves current Firestore to snapshots/
#   ./scripts/golden-run-snapshot.sh restore   — restores from snapshots/

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ok() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

CMD="${1:-help}"
PROJECT_ID="${GCP_PROJECT_ID:-skillbridge-76a4c}"
SNAPSHOT_DIR="scripts/snapshots"
mkdir -p "$SNAPSHOT_DIR"

case "$CMD" in
  capture)
    echo "=== Capturing Golden Run Snapshot ==="
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    SNAPSHOT_FILE="${SNAPSHOT_DIR}/golden-run-${TIMESTAMP}.json"

    python3 - <<EOF
import json
import os
from datetime import datetime, timezone

try:
    from google.cloud import firestore
    db = firestore.Client(project="${PROJECT_ID}")
    snapshot = {}
    collections = ["services", "contracts", "violations", "ghost_reports"]
    for col in collections:
        docs = db.collection(col).stream()
        snapshot[col] = [doc.to_dict() for doc in docs]
    with open("${SNAPSHOT_FILE}", "w") as f:
        json.dump(snapshot, f, indent=2, default=str)
    print(f"Snapshot saved to ${SNAPSHOT_FILE}")
    for col, docs in snapshot.items():
        print(f"  {col}: {len(docs)} documents")
except Exception as e:
    print(f"Error: {e}")
EOF

    # Always symlink latest
    ln -sf "golden-run-${TIMESTAMP}.json" "${SNAPSHOT_DIR}/latest.json"
    ok "Snapshot captured: ${SNAPSHOT_FILE}"
    ;;

  restore)
    echo "=== Restoring Golden Run Snapshot ==="
    SNAPSHOT_FILE="${2:-${SNAPSHOT_DIR}/latest.json}"

    if [[ ! -f "$SNAPSHOT_FILE" ]]; then
      echo "No snapshot found at ${SNAPSHOT_FILE}"
      echo "Run: ./scripts/golden-run-snapshot.sh capture"
      exit 1
    fi

    echo "Restoring from: $SNAPSHOT_FILE"
    read -p "This will overwrite current Firestore data. Continue? [y/N] " -n 1 -r
    echo ""
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then exit 0; fi

    python3 - <<EOF
import json
import sys

try:
    from google.cloud import firestore
    db = firestore.Client(project="${PROJECT_ID}")

    with open("${SNAPSHOT_FILE}") as f:
        snapshot = json.load(f)

    for col, docs in snapshot.items():
        for doc in docs:
            # Use the most likely ID field
            doc_id = doc.get("service_id") or doc.get("contract_id") or \
                     doc.get("report_id") or doc.get("violation_id") or \
                     doc.get("id", "unknown")
            db.collection(col).document(doc_id).set(doc)
        print(f"  Restored {len(docs)} docs to '{col}'")

    print("Restore complete.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
EOF

    ok "Golden run snapshot restored"
    ;;

  help|*)
    echo "Usage: $0 [capture|restore [snapshot-file]]"
    echo ""
    echo "  capture          Save current Firestore state to scripts/snapshots/"
    echo "  restore [file]   Restore Firestore from snapshot (default: latest.json)"
    ;;
esac
