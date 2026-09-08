#!/usr/bin/env bash
# Memory-safe browser cert: retest only prior FAILs, one batch at a time.
# Never starts local next dev — preview/staging only.
set -euo pipefail

if [[ -z "${CERT_BROWSER_PASSWORD:-}" ]]; then
  echo "Set CERT_BROWSER_PASSWORD before running." >&2
  exit 1
fi

if [[ -z "${BROWSER_CERT_PREVIEW_URL:-}" ]]; then
  echo "Set BROWSER_CERT_PREVIEW_URL to your Coolify preview URL (or set previewBaseUrl in browser-cert.config.ts)." >&2
  exit 1
fi

BATCHES=(
  BATCH-12
  CERT-APT
  CERT-MCTB
  CERT-CROSS
  CERT-GLOBAL
)

for batch in "${BATCHES[@]}"; do
  echo ""
  echo "========== Retesting batch: $batch =========="
  npm run cert:appointments-mctb-browser -- --only "$batch" --retest --retest-fails --continue-on-fail
  sleep 8
done

echo ""
echo "Done. See docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md"
