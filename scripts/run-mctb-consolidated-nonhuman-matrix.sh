#!/usr/bin/env bash
# Consolidated MCTB test-and-fix matrix (non-human, non-external-carrier-approval).
# Does NOT replace commercial certification — runs executable proofs before one deploy.
set -uo pipefail
cd "$(dirname "$0")/.."

LOG="${MCTB_MATRIX_LOG:-/tmp/mctb-consolidated-matrix.log}"
: >"$LOG"

if ssh -o BatchMode=yes -o ConnectTimeout=5 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  # shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
  source scripts/cloud-agent/ensure-self-hosted-redis-env.sh
fi
export NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"
export MCTB_CERT_SKIP_LIVE_DID_PURCHASE="${MCTB_CERT_SKIP_LIVE_DID_PURCHASE:-1}"

FAIL=0
PASS=0
SKIP=0

run_step() {
  local id="$1"
  shift
  echo ""
  echo ">>> [$id] $*"
  if "$@" >>"$LOG" 2>&1; then
    echo "    PASS"
    PASS=$((PASS + 1))
  else
    echo "    FAIL (see $LOG)"
    FAIL=$((FAIL + 1))
  fi
}

run_npx() {
  local id="$1"
  local script="$2"
  run_step "$id" npx tsx "$script"
}

echo "=== MCTB consolidated non-human matrix ===" | tee -a "$LOG"
date -u +"%Y-%m-%dT%H:%M:%SZ" | tee -a "$LOG"

# 31 Redis / BullMQ
run_step "31-guards" bash scripts/run-mctb-commercial-launch-guards.sh
run_step "31-bullmq-worker" npm run test:sms-worker-bullmq
run_step "31-final-pipeline" npm run verify:mctb-final-pipeline
run_npx "31-pipeline-contract" scripts/test-mctb-final-pipeline-contract.ts
run_npx "31-dispatch-worker" scripts/test-mctb-production-dispatch-worker.ts

# 1–4 Account, wizard policy, capabilities, provisioning contract
run_npx "1-stripe-entitlement" scripts/test-mctb-commercial-stripe-entitlement-lifecycle.ts
run_npx "1-capabilities" scripts/test-mctb-capabilities-resolver.ts
run_npx "2-first-run-policy" scripts/test-mctb-first-run-onboarding-policy.ts
run_npx "2-wizard-policy" scripts/test-mctb-first-run-wizard-policy.ts
run_npx "2-wizard-flow" scripts/test-mctb-onboarding-wizard-flow.ts
run_npx "2-onboarding-arch" scripts/test-mctb-onboarding-architecture.ts
run_npx "2-business-line" scripts/test-mctb-onboarding-business-line-persist.ts
run_npx "2-live-test-evidence" scripts/test-mctb-live-test-forwarding-evidence.ts
run_npx "3-provision-contract" scripts/test-mctb-trial-ingress-provision-contract.ts
run_npx "3-provision-e2e" scripts/test-mctb-trial-ingress-provision-e2e.ts

# 5–7 Templates, recovery, eligibility
run_npx "5-platform-templates" scripts/test-mctb-platform-template-enforcement.ts
run_npx "6-recovery-setup" scripts/test-mctb-setup-recovery.ts
run_npx "6-schedule-pause" scripts/test-mctb-schedule-pause.ts
run_npx "6-paused-fallback" scripts/test-mctb-paused-call-fallback.ts
run_npx "7-cooldown" scripts/test-mctb-recovery-cooldown-eligibility.ts
run_npx "7-max-messages" scripts/test-mctb-recovery-max-messages-field.ts
run_npx "8-usage-25-26" scripts/test-mctb-recovery-usage-idempotency.ts

# 9–10 Consent
run_npx "9-consent-modes" scripts/test-mctb-consent-modes.ts
run_npx "9-press1-db" scripts/test-mctb-press1-consent-db.ts
run_npx "10-existing-consent" scripts/test-mctb-existing-consent-attestation.ts
run_npx "15-consent-log" scripts/test-mctb-consent-log.ts

# 11–12 Jobs / inbound
run_npx "11-messaging-eligibility" scripts/test-mctb-messaging-provider-eligibility.ts
run_npx "12-caller-replied" scripts/test-mctb-caller-replied-inbound-path.ts
run_npx "12-inbound-plan" scripts/test-mctb-inbound-reply-notification-plan.ts

# 13–14 Missed calls / setup sections
run_npx "13-missed-filters" scripts/test-mctb-missed-calls-filters.ts
run_npx "14-setup-sections" scripts/test-mctb-setup-sections.ts
run_npx "26-setup-readiness" scripts/test-mctb-getting-started-readiness.ts

# 16 Voicemail
run_npx "16-vm-lifecycle" scripts/test-mctb-voicemail-lifecycle.ts
run_npx "16-vm-hermetic" scripts/test-mctb-voicemail-ai-hermetic.ts
run_npx "16-vm-inbox" scripts/test-mctb-voicemail-inbox-row.ts
run_npx "16-vm-entitlements" scripts/test-mctb-voicemail-entitlements.ts
run_npx "16-vm-workspace" scripts/test-mctb-voicemail-workspace.ts

# 17–18 Notifications / urgent
run_npx "17-email-dest" scripts/test-mctb-handoff-recipient-email-destination.ts
run_npx "17-email-contract" scripts/test-mctb-caller-replied-email-delivery-contract.ts
run_step "17-brevo-e2e" env MCTB_HANDOFF_EMAIL_TEST_CAPTURE=1 npx tsx scripts/test-mctb-brevo-handoff-delivery-e2e.ts
run_npx "18-urgent" scripts/test-mctb-urgent-handoff-guards.ts
run_npx "18-lead-policy" scripts/test-mctb-lead-recovery-intent-policy-separation.ts

# 19 STOP/HELP (protocol helpers)
run_npx "19-simplified-launch" scripts/test-mctb-simplified-launch.ts

# 20 Exclusions
run_npx "20-exclusions" scripts/test-mctb-setup-exclusions.ts

# 21 Links / notifications setup
run_npx "21-links" scripts/test-mctb-setup-links.ts
run_npx "21-notifications" scripts/test-mctb-setup-notifications.ts
run_npx "21-consent-setup" scripts/test-mctb-setup-consent.ts

# 22–23 AI / own sender / platform
run_npx "22-ai-gate" scripts/test-mctb-ai-recovery-entitlement-gate.ts
run_npx "23-platform-sender" scripts/test-mctb-platform-sender.ts
run_npx "23-sender-mode" scripts/test-mctb-setup-sender-mode-persist.ts
run_npx "23-tfv-gates" scripts/test-mctb-tfv-gates.ts

# 24–25 Analytics / phases
run_npx "24-analytics-range" scripts/test-mctb-analytics-range.ts
run_npx "24-engine-matrix" scripts/test-mctb-engine-matrix.ts
run_npx "25-production-phases" scripts/test-mctb-production-phases.ts
run_npx "25-onboarding-entry" scripts/test-mctb-onboarding-entry-path.ts

# 28 Multi-tenancy
run_npx "28-tenant-isolation" scripts/test-mctb-platform-inbound-tenant-isolation.ts
run_npx "28-number-scope" scripts/test-mctb-number-identity-scope.ts

# 27 Round-trip / reconciliation
run_npx "27-pass6" scripts/test-mctb-pass-6-final-reconciliation.ts

# 34 Fixture leak
run_step "34-no-dev-badge" npx tsx scripts/verify-mctb-production-no-dev-issue-badge.ts
run_step "34-stage2-presentation" npm run verify:mctb-stage2-presentation

# PSTN readiness (code checks only — not physical PSTN)
run_npx "38-pstn-readiness" scripts/test-mctb-pstn-production-readiness.ts

echo ""
echo "=== MATRIX SUMMARY: PASS=$PASS FAIL=$FAIL (log: $LOG) ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
