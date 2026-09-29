#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"

echo "=== MCTB commercial launch guards ==="
npx tsx scripts/test-mctb-capabilities-resolver.ts
npx tsx scripts/test-mctb-recovery-usage-idempotency.ts
npx tsx scripts/test-mctb-recovery-cooldown-eligibility.ts
npx tsx scripts/test-mctb-setup-recovery.ts
npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts
npx tsx scripts/test-mctb-setup-sender-mode-persist.ts
npx tsx scripts/test-mctb-ai-recovery-entitlement-gate.ts
npx tsx scripts/test-mctb-existing-consent-attestation.ts
npx tsx scripts/test-mctb-platform-template-enforcement.ts
NODE_OPTIONS="${NODE_OPTIONS} --import ./scripts/preload-server-only.mjs" npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts
npx tsx scripts/test-mctb-urgent-handoff-guards.ts
npx tsx scripts/test-mctb-caller-replied-inbound-path.ts
npx tsx scripts/test-mctb-caller-replied-email-delivery-contract.ts
npx tsx scripts/test-mctb-inbound-reply-notification-plan.ts
npx tsx scripts/test-mctb-onboarding-entry-path.ts
npx tsx scripts/test-mctb-first-run-wizard-policy.ts
npx tsx scripts/test-mctb-live-test-forwarding-evidence.ts
npx tsx scripts/test-mctb-onboarding-business-line-persist.ts
npx tsx scripts/test-mctb-getting-started-shell.ts
npx tsx scripts/test-mctb-getting-started-readiness.ts
npx tsx scripts/test-opus-visual-token-parity.ts
npx tsx src/lib/mctb/message-template.test.ts
npm run verify:mctb-stage2-presentation
echo "=== ALL MCTB COMMERCIAL GUARDS PASS ==="
