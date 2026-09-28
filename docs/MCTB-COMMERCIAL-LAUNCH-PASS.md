# MCTB final commercial launch pass

**Status:** IN PROGRESS — automated certification expanded; **handset PSTN** remains the single user-action gate after merge/deploy.

**Evidence matrix:** `docs/MCTB-FINAL-PRODUCT-FUNCTIONALITY-GAPS.md`

**Out of scope:** `docs/MCTB-COMMERCIAL-LAUNCH-OUT-OF-SCOPE.md` (`test:mctb-timeout-retry-voice-hardening` / Voice V3 durable booking).

**Frozen:** Pure Opus shell, `mctb_texml_final_v1`, both consent branches.

## One-command automated certification

```bash
# Full bundle (guards + TeXML + Stripe + ingress + Brevo + PSTN preflight)
bash scripts/run-mctb-commercial-launch-certification.sh

# Repeat runs without purchasing another live Telnyx DID:
MCTB_CERT_SKIP_LIVE_DID_PURCHASE=1 bash scripts/run-mctb-commercial-launch-certification.sh
```

Live fresh-workspace ingress (Telnyx acquire + frozen TeXML bind) was proven once via `test-mctb-trial-ingress-provision-e2e.ts` (see gaps log).

## §38 browser certification (MCTB-01–58)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/reset-cert-browser-password.ts
export BROWSER_CERT_PREVIEW_URL="$APP_URL"
export CERT_BROWSER_PASSWORD='…'   # cert account — see seed script / reset helper
export BROWSER_CERT_ALLOW_DEPLOY_SHA_MISMATCH=1   # only when certing deployed SHA ahead of local HEAD
npm run cert:appointments-mctb-browser -- --only CERT-MCTB --continue-on-fail
```

## Certification evidence rows

| Row | Status | Evidence |
|-----|--------|----------|
| `CAPABILITIES` | **COMPLETE** | `test-mctb-capabilities-resolver.ts` |
| `FREE_USAGE` | **COMPLETE** | `test-mctb-recovery-usage-idempotency.ts` |
| `COOLDOWN_UI_RUNTIME` | **COMPLETE** | `test-mctb-recovery-cooldown-eligibility.ts` |
| `FRESH_WORKSPACE_PROVISIONING` | **COMPLETE** | `test-mctb-trial-ingress-provision-contract.ts` + live `test-mctb-trial-ingress-provision-e2e.ts` |
| `STRIPE_ENTITLEMENT_LIFECYCLE` | **COMPLETE** | `test-mctb-commercial-stripe-entitlement-lifecycle.ts` |
| `BREVO_REPLY_EMAIL` | **COMPLETE** | `test-mctb-brevo-handoff-delivery-e2e.ts` + caller_replied guards |
| `AI_RECOVERY_ENTITLEMENT` | **COMPLETE** | `test-mctb-ai-recovery-entitlement-gate.ts` + Stripe addon lifecycle |
| `URGENT_HANDOFF` | **COMPLETE** (automated) | `test-mctb-urgent-handoff-guards.ts` + Brevo urgent row in E2E |
| `EXISTING_CONSENT_GATE` | **COMPLETE** (product) | `test-mctb-existing-consent-attestation.ts`; PSTN proof pending |
| `PRESS_1_E2E` | **PSTN handset** | `test-mctb-pstn-production-readiness.ts` + manual script below |
| `EXISTING_CONSENT_E2E` | **PSTN handset** | same |
| `OWN_SENDER` | **EXTERNAL_APPROVAL_PENDING** | per-number TFV/10DLC; add-on entitlement in Stripe lifecycle test |
| `MCTB_COMMERCIAL_LAUNCH_CERTIFICATION` | **IN PROGRESS** | `run-mctb-commercial-launch-certification.sh` PASS; browser CERT-MCTB + deploy SHA |
| `MCTB_END_TO_END_FUNCTIONALITY` | **PSTN handset** | all automated paths green; two PSTN calls remain |

## Handset PSTN script (after merge/deploy + cert browser PASS)

Use workspace with verified CFNA to ingress TFN, `press_1` or `existing_consent` as configured.

**Press-1:** Call public business line from a second phone; do not answer; hear disclosure; press `1`; expect compliance SMS then recovery opener; reply once; agent inspects missed-call detail + conversation + `mctbNotificationDelivery` rows.

**Existing consent:** Requires Recovery paid + valid certification; call business line; hear voicemail greeting; leave short message; hang up; expect recovery SMS without press-1; inspect voicemail + recovery timeline.

## Deploy discipline

Merge PR → Coolify green → `/api/health` `commitSha` match → re-run certification + browser cert without `BROWSER_CERT_ALLOW_DEPLOY_SHA_MISMATCH`.
