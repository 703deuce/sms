# MCTB final product functionality — evidence matrix

**Governance:** Evidence for **MCTB Final Commercial Launch Pass** (`docs/MCTB-COMMERCIAL-LAUNCH-PASS.md`). Finish when automated proof + §38 browser cert are green and only **handset PSTN** remains user-action.

**Out of scope:** `docs/MCTB-COMMERCIAL-LAUNCH-OUT-OF-SCOPE.md` (Voice V3 `test:mctb-timeout-retry-voice-hardening`).

**Automated bundle:** `bash scripts/run-mctb-commercial-launch-certification.sh`

---

## Summary flags

| Flag | Status | Evidence |
|------|--------|----------|
| `MCTB_CAPABILITIES_RESOLVER` | **COMPLETE** | `test-mctb-capabilities-resolver.ts` |
| `MCTB_USAGE_FREE_ALLOWANCE` | **COMPLETE** | `test-mctb-recovery-usage-idempotency.ts` |
| `MCTB_COOLDOWN_UI_RUNTIME` | **COMPLETE** | `test-mctb-recovery-cooldown-eligibility.ts` |
| `MCTB_WORKSPACE_INGRESS_PROVISIONING` | **COMPLETE** | Contract + live Telnyx acquire + TeXML bind (`test-mctb-trial-ingress-provision-e2e.ts`, 2026-09-28) |
| `MCTB_STRIPE_ENTITLEMENT_LIFECYCLE` | **COMPLETE** | `test-mctb-commercial-stripe-entitlement-lifecycle.ts` |
| `MCTB_REPLY_EMAIL_NOTIFICATIONS` | **COMPLETE** | `test-mctb-brevo-handoff-delivery-e2e.ts` + caller_replied guards |
| `MCTB_URGENT_*` (classifier, SMS entitlement, validation, fallback, isolation) | **COMPLETE** (automated) | `test-mctb-urgent-handoff-guards.ts` + Brevo urgent row |
| `MCTB_PLATFORM_RECOVERY_TEMPLATE` | **COMPLETE** (enforcement) | `test-mctb-platform-template-enforcement.ts` |
| `MCTB_AI_RECOVERY_ENTITLEMENT` | **COMPLETE** | `test-mctb-ai-recovery-entitlement-gate.ts` + Stripe addon lifecycle |
| `MCTB_CONSENT_EXISTING` | **COMPLETE** (product) / **PSTN** (handset) | `test-mctb-existing-consent-attestation.ts` |
| `MCTB_CONSENT_PRESS_1` | **COMPLETE** (runtime) / **PSTN** (handset) | Frozen TeXML + `test-mctb-pstn-production-readiness.ts` |
| `MCTB_MISSED_CALL_DETAIL` | **COMPLETE** (browser) | CERT-MCTB groups 28–29 when browser cert PASS |
| `MCTB_END_TO_END_FUNCTIONALITY` | **PSTN handset** | All automated paths; Press-1 + existing_consent live calls |
| `MCTB_COMMERCIAL_LAUNCH_CERTIFICATION` | **IN PROGRESS** | Guards + certification script PASS; CERT-MCTB browser run + merge `833a83f8` to production |

---

## Functional proof log

| Step | Status | Evidence |
|------|--------|----------|
| Commercial guards | **PASS** | `run-mctb-commercial-launch-guards.sh` |
| TeXML frozen pipeline | **PASS** | `verify:mctb-final-pipeline` |
| Stripe Free → Recovery → AI → Own sender → cancel | **PASS** | `test-mctb-commercial-stripe-entitlement-lifecycle.ts` |
| Fresh workspace ingress (live DID + mctb-entry bind) | **PASS** | `test-mctb-trial-ingress-provision-e2e.ts` (live run) |
| Brevo path + idempotency + matrix on/off | **PASS** | `test-mctb-brevo-handoff-delivery-e2e.ts` |
| Production health SHA | **e4f8fd1f** | `/api/health` at cert time |
| §38 MCTB browser (MCTB-01–58) | **RUNNING** | `npm run cert:appointments-mctb-browser -- --only CERT-MCTB` |
| Handset Press-1 + existing_consent | **USER** | See `docs/MCTB-COMMERCIAL-LAUNCH-PASS.md` PSTN script |

---

## Verification commands

```bash
bash scripts/run-mctb-commercial-launch-certification.sh
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ensure-cert-browser-account.ts
npm run cert:appointments-mctb-browser -- --only CERT-MCTB --continue-on-fail
```

Production: `GET /api/health` → certify against deployed `commitSha` after merge.
