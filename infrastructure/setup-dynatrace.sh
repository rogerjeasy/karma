#!/usr/bin/env bash
# Setup and verification script for Dynatrace integration.
#
# Usage:
#   ./infrastructure/setup-dynatrace.sh setup          — interactive setup wizard
#   ./infrastructure/setup-dynatrace.sh verify-tools   — confirm MCP tools accessible
#   ./infrastructure/setup-dynatrace.sh verify-events  — confirm Logs Ingest works

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

CMD="${1:-help}"

# ── Resolve env vars from shell or .env ────────────────────────────────────
# Reads a single variable from .env without sourcing the file.
# Sourcing .env is unsafe — values like <placeholder> contain shell metacharacters.
_read_dotenv_var() {
  local varname="$1"
  local _env_file="${2:-.env}"
  [[ -f "$_env_file" ]] || return 0
  local raw
  raw=$(grep -E "^${varname}=" "$_env_file" | tail -1 | cut -d= -f2-)
  # Strip optional surrounding single or double quotes
  raw="${raw%\"}" ; raw="${raw#\"}"
  raw="${raw%\'}" ; raw="${raw#\'}"
  [[ -n "$raw" ]] && export "${varname}=${raw}"
}

_load_env() {
  [[ -n "${DT_ENV:-}"       ]] || _read_dotenv_var DT_ENV
  [[ -n "${DT_API_TOKEN:-}" ]] || _read_dotenv_var DT_API_TOKEN
  [[ -n "${DT_ENV:-}" ]]       || fail "DT_ENV must be set (or present in .env)"
  [[ -n "${DT_API_TOKEN:-}" ]] || fail "DT_API_TOKEN must be set (or present in .env)"
}

_load_env_with_otel() {
  _load_env
  [[ -n "${DT_OTEL_TOKEN:-}" ]] || _read_dotenv_var DT_OTEL_TOKEN
  [[ -n "${DT_OTEL_TOKEN:-}" ]] || fail "DT_OTEL_TOKEN must be set (or present in .env)"
}

_mcp_url() {
  echo "https://${DT_ENV}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp"
}

_base_url() {
  echo "https://${DT_ENV}.apps.dynatrace.com"
}

_classic_base_url() {
  echo "https://${DT_ENV}.live.dynatrace.com"
}

case "$CMD" in
  setup)
    echo "=== Karma — Dynatrace Setup Wizard ==="
    echo ""
    read -rp "Enter your Dynatrace environment name (the subdomain, e.g. abc12345): " DT_ENV
    read -rsp "Enter your Platform Token: " DT_API_TOKEN
    echo ""

    MCP_URL="$(_mcp_url)"

    echo ""
    echo "Testing MCP gateway connection..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer ${DT_API_TOKEN}" \
      "${MCP_URL}")

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "400" ]]; then
      ok "MCP gateway reachable (HTTP $HTTP_CODE)"
    else
      warn "MCP gateway returned HTTP $HTTP_CODE — check token scopes (mcp-gateway:servers:invoke, mcp-gateway:servers:read)"
    fi

    echo ""
    echo "Storing Platform Token in Secret Manager..."
    if echo -n "$DT_API_TOKEN" | gcloud secrets versions add dt-api-token \
        --data-file=- \
        --project="${GCP_PROJECT_ID:-skillbridge-76a4c}" 2>/dev/null; then
      ok "Updated existing secret 'dt-api-token'"
    else
      echo -n "$DT_API_TOKEN" | gcloud secrets create dt-api-token \
        --data-file=- \
        --project="${GCP_PROJECT_ID:-skillbridge-76a4c}"
      ok "Created secret 'dt-api-token'"
    fi

    echo ""
    echo "Updating .env..."
    # Update DT_ENV and clear DT_MCP_URL (agent code derives it from DT_ENV)
    if [[ -f .env ]]; then
      sed -i.bak \
        -e "s/^DT_ENV=.*/DT_ENV=${DT_ENV}/" \
        -e "s/^DT_TENANT_ID=.*/DT_ENV=${DT_ENV}/" \
        -e "s/^DT_MCP_URL=.*/DT_MCP_URL=/" \
        .env
      ok "Updated .env: DT_ENV=${DT_ENV}, DT_MCP_URL cleared (derived automatically)"
    else
      warn ".env not found — create one from .env.example and set DT_ENV and DT_API_TOKEN"
    fi

    echo ""
    ok "Setup complete."
    echo "  Next: ./infrastructure/setup-dynatrace.sh verify-tools"
    ;;

  verify-tools)
    echo "=== Verifying Dynatrace MCP Tools ==="
    echo ""
    _load_env

    MCP_URL="$(_mcp_url)"
    echo "Endpoint: ${MCP_URL}"
    echo ""

    REQUIRED_TOOLS=(
      "create-dql"
      "execute-dql"
      "explain-dql"
      "ask-dynatrace-docs"
      "query-problems"
      "get-problem-by-id"
      "get-vulnerabilities"
      "get-events-for-kubernetes-cluster"
      "timeseries-forecast"
      "timeseries-novelty-detection"
      "adaptive-anomaly-detector"
      "seasonal-baseline-anomaly-detector"
      "static-threshold-analyzer"
      "find-documents"
      "find-troubleshooting-guides"
      "get-entity-id"
      "get-entity-name"
    )

    RESPONSE=$(curl -sf \
      -H "Authorization: Bearer ${DT_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"tools/list","id":1,"params":{}}' \
      "${MCP_URL}" 2>/dev/null || echo "")

    if [[ -z "$RESPONSE" ]]; then
      fail "No response from MCP gateway — check network and token scopes"
    fi

    PASS=0
    FAIL=0

    for tool in "${REQUIRED_TOOLS[@]}"; do
      if echo "$RESPONSE" | grep -q "\"${tool}\""; then
        ok "${tool}"
        ((PASS++))
      else
        warn "${tool} — not found in response"
        ((FAIL++))
      fi
    done

    echo ""
    echo "${PASS}/${#REQUIRED_TOOLS[@]} tools confirmed."
    if [[ $FAIL -gt 0 ]]; then
      warn "${FAIL} tools not confirmed. If the token and URL are correct this may be a"
      warn "tenant plan limitation — run the demo to verify tool availability at runtime."
    else
      ok "All ${#REQUIRED_TOOLS[@]} MCP tools verified."
    fi
    ;;

  verify-events)
    echo "=== Verifying Dynatrace Logs Ingest ==="
    echo ""
    _load_env_with_otel

    LOGS_URL="$(_classic_base_url)/api/v2/logs/ingest"
    EVENT_ID="karma-test-$(date +%s)"

    echo "Endpoint: ${LOGS_URL}"
    echo "Sending test log record (karma.event_id=${EVENT_ID})..."

    PAYLOAD=$(cat <<EOF
[
  {
    "content": "Karma Logs Ingest connectivity test",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "log.source": "karma-agent",
    "karma.event_id": "${EVENT_ID}",
    "karma.event_type": "karma.setup.verify",
    "karma.title": "Karma Logs Ingest connectivity test",
    "karma.script": "setup-dynatrace.sh verify-events"
  }
]
EOF
)

    HTTP_CODE=$(curl -s -o /tmp/karma-events-response.txt -w "%{http_code}" \
      -X POST "${LOGS_URL}" \
      -H "Authorization: Api-Token ${DT_OTEL_TOKEN}" \
      -H "Content-Type: application/json; charset=utf-8" \
      -d "$PAYLOAD")

    # Logs Ingest API v2 returns 204 No Content on success (no body).
    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "202" || "$HTTP_CODE" == "204" ]]; then
      ok "Logs Ingest reachable (HTTP $HTTP_CODE)"
      echo ""
      echo "Verify in Dynatrace with DQL:"
      echo "  fetch logs | filter log.source == \"karma-agent\" | filter karma.event_type == \"karma.setup.verify\" | sort timestamp desc | limit 5"
    elif [[ "$HTTP_CODE" == "401" ]]; then
      fail "HTTP 401 — check that DT_OTEL_TOKEN has scope: logs.ingest"
    elif [[ "$HTTP_CODE" == "403" ]]; then
      fail "HTTP 403 — token is valid but missing scope: logs.ingest"
    else
      warn "HTTP ${HTTP_CODE} — response body:"
      cat /tmp/karma-events-response.txt
    fi
    ;;

  help|*)
    echo "Usage: $0 [setup|verify-tools|verify-events]"
    echo ""
    echo "  setup           Interactive setup wizard (token → Secret Manager, .env update)"
    echo "  verify-tools    Confirm all required MCP tools are accessible"
    echo "  verify-events   Confirm Logs Ingest is reachable (requires DT_OTEL_TOKEN with logs.ingest scope)"
    ;;
esac
