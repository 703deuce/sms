#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  # shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
  source scripts/cloud-agent/ensure-self-hosted-redis-env.sh
fi
export NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"

echo "=== MCTB commercial launch certification (automated) ==="
bash scripts/run-mctb-commercial-launch-guards.sh
npm run verify:mctb-final-pipeline
npm run test:mctb-final-pipeline-contract 2>/dev/null || npx tsx scripts/test-mctb-final-pipeline-contract.ts

npx tsx scripts/test-mctb-commercial-stripe-entitlement-lifecycle.ts
# Live Telnyx DID acquire runs once per environment; set MCTB_CERT_SKIP_LIVE_DID_PURCHASE=1 to use DB-seeded path only.
npx tsx scripts/test-mctb-trial-ingress-provision-e2e.ts
NODE_OPTIONS="${NODE_OPTIONS}" npx tsx scripts/test-mctb-brevo-handoff-delivery-e2e.ts
npx tsx scripts/test-mctb-pstn-production-readiness.ts
npx tsx scripts/test-mctb-first-run-onboarding-policy.ts
npx tsx scripts/test-mctb-paused-call-fallback.ts

echo ""
echo "Note: test:mctb-timeout-retry-voice-hardening is OUT_OF_SCOPE_MCTB_COMMERCIAL_CERTIFICATION"
echo "      See docs/MCTB-COMMERCIAL-LAUNCH-OUT-OF-SCOPE.md"
echo "=== MCTB COMMERCIAL LAUNCH AUTOMATED CERTIFICATION PASS ==="
