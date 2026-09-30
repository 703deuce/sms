#!/usr/bin/env bash
# Run MCTB certification suites in one batch; log failures (no per-fix deploy).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ARTIFACT_DIR="${MCTB_PROD_CERT_ARTIFACTS:-/tmp/mctb-prod-cert-batch}"
mkdir -p "$ARTIFACT_DIR"
REPORT="$ARTIFACT_DIR/batch-report.txt"
: "${MCTB_PROD_CERT_BASE_URL:?Set MCTB_PROD_CERT_BASE_URL}"
BASE="$MCTB_PROD_CERT_BASE_URL"
EMAIL="${MCTB_PROD_CERT_EMAIL:-${ADMIN_EMAILS%%,*}}"

sha="$(curl -sS "$BASE/api/health" | jq -r '.commitSha // "unknown"')"
echo "MCTB production cert batch — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$REPORT"
echo "Production SHA: $sha" >> "$REPORT"
echo "" >> "$REPORT"

failures=0

run_suite() {
  local name="$1"
  shift
  local logfile="$ARTIFACT_DIR/$(echo "$name" | tr ' /' '__').log"
  echo "=== RUN $name ===" | tee -a "$REPORT"
  set +e
  "$@" >"$logfile" 2>&1
  local code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    echo "PASS $name (exit 0)" | tee -a "$REPORT"
  else
    echo "FAIL $name (exit $code) — see $logfile" | tee -a "$REPORT"
    failures=$((failures + 1))
    tail -30 "$logfile" >> "$REPORT"
    echo "---" >> "$REPORT"
  fi
}

run_suite "browser-notifications-only" env \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  MCTB_PROD_CERT_BASE_URL="$BASE" \
  MCTB_PROD_CERT_EMAIL="$EMAIL" \
  npx tsx scripts/mctb-production-browser-cert-continue.ts --only-notifications

run_suite "commercial-launch-guards" bash scripts/run-mctb-commercial-launch-guards.sh
run_suite "job-queue-lifecycle" npm run test:job-queue-lifecycle

echo "" | tee -a "$REPORT"
echo "Total failed suites: $failures" | tee -a "$REPORT"
echo "Full report: $REPORT"
exit $((failures > 0 ? 2 : 0))
