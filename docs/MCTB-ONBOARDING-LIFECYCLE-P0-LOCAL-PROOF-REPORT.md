# MCTB onboarding P0 — local proof report (pre-push)

**Branch:** `cursor/mctb-lifecycle-p0-f350` (local, not pushed)  
**Purpose:** Close proof gaps before single production push.

---

## 1. Tests added/changed

| Test | Path |
|------|------|
| **New — full proof suite** | `scripts/test-mctb-onboarding-lifecycle-p0-proof.ts` |
| Existing P0 suite (updated earlier) | `scripts/test-mctb-onboarding-lifecycle-p0.ts` |

**Proof suite covers:**

- Concurrent `provisionMctbWorkspaceTollFreeIngress()` with mocked purchase/import/route (exactly one purchase, same E.164/phone row).
- Purchase success → local import failure → retry (pending E.164, zero second purchase).
- Activation fail → retry → success without new live test; idempotent re-activation.
- Cross-tenant DID ambiguity (equal scores → `null` + `ingress_phone_row_ambiguous`).
- Unambiguous customer DID resolves customer workspace (not `ws_1` when owner exists).
- `existing_consent` without attestation → **DENY**; with attestation → **ALLOW**.

---

## 2. Exact results

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-onboarding-lifecycle-p0-proof.ts
# → test-mctb-onboarding-lifecycle-p0-proof: PASS

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-onboarding-lifecycle-p0.ts
# → test-mctb-onboarding-lifecycle-p0: PASS

npm run test:job-queue-lifecycle
# → job_queue_lifecycle: PASS

npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts
# → FAIL (assertion: onboarding API must reference provisionTrialMctbNumber)

bash scripts/run-mctb-commercial-launch-guards.sh
# → Stops at same contract failure when run in order (set -e); not a false-green if script completes — see §9.
```

---

## 3. Implementation changes forced by new tests

| Change | Why |
|--------|-----|
| `workspace-ingress-provision-lock.ts` — in-process mutex fallback when `pg_advisory_lock` unavailable | Concurrent provision tests run in compat DB without advisory SQL |
| `provision-workspace-toll-free-ingress.ts` — catch import failures, return `{ ok: false, error: "ingress_import_failed" }` | Pending E.164 must survive local failure for retry proof |
| `provision-workspace-toll-free-ingress.ts` — test deps (purchase, import, route, verify, `setActiveCallHandler`) | Mock Telnyx boundary without live purchase |
| `wizard-flow.ts` — preserve `currentStep: "complete"` in `normalizeOnboardingStep` | Activation wrote `complete` but parser collapsed it (state machine bug) |
| `trial.ts` — idempotent early return when `trialActivatedAt` + `billingPlan: free` | Re-activation must not rewrite activation timestamp |
| `live-test-recovery-send.ts` — `existing_consent` requires `existingConsentCertification` + `validateExistingConsentAttestation` | Close backdoor vs Press-1-only onboarding path |

---

## 4. Existing-consent gating

- **Manipulated** `consentMode: existing_consent` **without** attestation → `authorizeOnboardingLiveTestRecoverySend` → **false** (proof test).
- **With** `recordWorkspaceExistingConsentAttestation` → **true** when live-test preconditions otherwise met.
- Press-1 path still requires `smartRoutingSmsConsentEvent` (unchanged in `test-mctb-onboarding-lifecycle-p0.ts`).
- The onboarding exception still **only** bypasses `canSendAutomaticRecovery` during `ONBOARDING`; it does not bypass STOP, forwarding, platform sender, or consent-mode authorization.

---

## 5. Concurrent provisioning → one mocked purchase

**Yes.** `purchaseCalls === 1` after `Promise.all([provision, provision])`; both results share the same `phoneNumberId` and E.164.

---

## 6. Purchase-success / local-failure / retry → zero additional purchases

**Yes.** First attempt: purchase once, import throws, pending E.164 persisted. Retry: `purchaseCalls` still 1, provision `ok: true`, pending cleared.

---

## 7. Activation failure → retry → success without another live test

**Yes.** First `activateMctbTrial` fails with `forwarding_connected` missing; `billingPlan` stays `onboarding`, `isOnboardingComplete()` false, `liveTestPassedAt` preserved. After forwarding fields saved, second activation sets `billingPlan: free`, `mctbServiceStatus: ACTIVE`, `currentStep: complete`, `trialActivatedAt` set.

---

## 8. Ambiguous cross-workspace DID → reject, not guess

**Yes.** Two workspaces, same E.164, symmetric ingress config + active MCTB config → `resolveBestMctbIngressPhoneRow` returns `null`; `getLastMctbIngressPhoneRowAmbiguityForTest()` records both workspace IDs. Customer-only DID resolves to customer workspace (not `ws_1` when owner workspace exists in DB).

---

## 9. Commercial launch guard status

| Item | Detail |
|------|--------|
| **Failing guard** | `scripts/test-mctb-trial-ingress-provision-contract.ts` |
| **Why** | Static assert expects `provisionTrialMctbNumber` in `src/app/api/mctb/onboarding/route.ts`; implementation uses `ensureMctbWorkspaceIngressReady` / toll-free ingress path instead. |
| **Product requirement** | Ingress provisioning still occurs via onboarding actions; contract text is **stale** relative to implementation — not evidence that provisioning is missing. |
| **False-green exit code?** | `run-mctb-commercial-launch-guards.sh` uses `set -euo pipefail`. Running `npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts` alone exits **non-zero** on failure. If the full guard script ever prints exit 0 after a failed assert, that would be an environment/run anomaly; **do not treat a failed contract assert as PASS.** |

**Not fixed in this pass** (per scope): guard regex not updated to match `ensureMctbWorkspaceIngressReady` — report only.

---

## 10. Advisory lock note (production)

- Production Postgres should use **`pg_advisory_lock`** (preferred).
- Test/compat environments without advisory SQL use an **in-process mutex** (same Node process only).
- Multi-instance production still relies on Postgres advisory locks when available.

---

## STOP

No push, merge, deploy, real Telnyx purchase, or PSTN in this pass.
