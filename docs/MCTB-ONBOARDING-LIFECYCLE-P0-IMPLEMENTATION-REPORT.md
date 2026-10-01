# MCTB onboarding lifecycle P0 — implementation report

**Branch:** `cursor/mctb-lifecycle-p0-f350`  
**Commit:** `ebdae9cc` (local; not pushed unless you approve)  
**Scope:** P0 live-test SMS deadlock, activation/onboarding completion state machine, ingress provisioning lock, inbound DID resolution hardening.

---

## A. Root cause (four areas)

### P0-1 — Onboarding live-test SMS deadlock

`billingPlan: "onboarding"` → `getMctbEntitlement()` sets `canSendAutomaticRecovery: false` → `evaluateMissedCallTextEligibility()` blocked all recovery, including the one live-test SMS required for `smsSentAt` and trial activation.

### P0-2 — `ready` treated as onboarding complete

`markLiveTestPassed()` set `currentStep: "ready"` before activation; `isOnboardingComplete()` returned true for `ready` without `trialActivatedAt`. The `activate_trial` API also wrote `ready` + `trialActivatedAt` on top of `activateMctbTrial()` without handling activation failure.

### Hardening — Provisioning concurrency

`provisionMctbWorkspaceTollFreeIngress()` had idempotent re-reads but no cross-request lock; concurrent calls could reach Telnyx purchase twice.

### Hardening — Inbound DID → workspace

`resolveInboundPhoneRowByE164()` fell back to `findFirst` ordered by `purchasedAt` when scored resolution failed — ambiguous when duplicate E.164 rows exist across workspaces (`@@unique([workspaceId, e164])` only, not global E.164 uniqueness).

---

## B. Files changed

| File | Why |
|------|-----|
| `src/lib/mctb/onboarding/live-test-recovery-send.ts` | **New** — server-side live-test recovery authorization |
| `src/lib/agents/missed-call-text-back/eligibility.ts` | Onboarding exception before entitlement block |
| `src/lib/mctb/onboarding/state.ts` | `isOnboardingComplete()` requires `trialActivatedAt` |
| `src/lib/mctb/onboarding/live-test.ts` | Activation failure handling; no “complete” without activation |
| `src/lib/mctb/onboarding/types.ts` | `trialActivationPendingAt` / `trialActivationLastError` |
| `src/app/api/mctb/onboarding/route.ts` | `activate_trial` defers to `activateMctbTrial()`; records failure |
| `src/lib/mctb/provisioning/workspace-ingress-provision-lock.ts` | **New** — advisory lock + pending E.164 after purchase |
| `src/lib/mctb/provisioning/provision-workspace-toll-free-ingress.ts` | Lock wrapper, resume pending purchase |
| `src/lib/mctb/texml-ingress/resolve-phone-row.ts` | Reject tied scores across different workspaces |
| `src/lib/phone/resolve-inbound-e164.ts` | Remove ambiguous global `findFirst` fallback |
| `scripts/test-mctb-onboarding-lifecycle-p0.ts` | **New** — focused P0 tests |

---

## C. New customer state machine

```
Sign up → billingPlan: onboarding
  → wizard steps (business line, consent, recovery, voicemail, notifications, CFNA)
  → provision ingress (locked) + platform sender
  → start live test (liveTestSession.startedAt)
  → PSTN miss on ingress + forwarding evidence + consent
  → authorized onboarding recovery SMS (platform sender) → smsSentAt
  → inbound reply → liveTestPassedAt, currentStep: ready
  → activateMctbTrial()
       ├─ success → billingPlan: free, mctbServiceStatus: ACTIVE, trialActivatedAt, currentStep: complete → isOnboardingComplete: true
       └─ failure → liveTestPassedAt kept, currentStep: ready, trialActivationLastError → isOnboardingComplete: false (retry activate_trial, no PSTN redo)
```

**Invariant:** MCTB onboarding is **not** complete until trial activation has actually succeeded (`trialActivatedAt`).  
**`ready`** means setup/live test is ready for activation — **not** “onboarding complete.”

---

## D. Live-test authorization

Allowed only when **all** of the following hold (see `authorizeOnboardingLiveTestRecoverySend`):

- Workspace `billingPlan` is `onboarding` and entitlement is `ONBOARDING` with automatic recovery **off** (not a general onboarding bypass).
- Active `liveTestSession.startedAt`, no `trialActivatedAt`.
- Missed-call event matches `idempotencyKey`, same workspace, `detectedAt` after session start, ingress `businessE164` = forward target.
- Forwarding verified (forwarded-from matches business line).
- Consent: `existing_consent` or Press-1 `smartRoutingSmsConsentEvent` since session start.
- `senderMode === PLATFORM`, MCTB enabled.
- Not demo; at most one recovery SMS per live-test window; bound to session `missedCallEventId` when set.

**Still blocked:** arbitrary onboarding SMS (no session/consent/forwarding), STOP/suppression, cooldown/idempotency, wrong workspace, second test send.

Ordinary onboarding workspaces without that path still get `ENTITLEMENT_SUSPENDED`.

**Trace (intended):** live-test missed call → eligibility → authorized onboarding test send → durable job → SMS worker → platform sender → `smsSentAt` → inbound reply → live test pass.

---

## E. Provisioning idempotency

- `provisionMctbWorkspaceTollFreeIngress()` runs inside `withMctbWorkspaceIngressProvisionLock()` using **Postgres `pg_advisory_lock(MCTB, hash(workspaceId))`** so concurrent requests serialize; the second caller re-checks `workspaceIngressAlreadyReady()` after the first finishes.
- After Telnyx purchase, **`mctbIngressProvisionPending.e164`** is written to `workspace_limits` before import/route; retries reuse that E.164 instead of buying again; cleared on successful provision.

**Dangerous boundary:** external purchase succeeds but local persistence fails → pending E.164 is detectable/recoverable; blind second purchase is avoided while pending exists.

---

## F. Tenant resolution

- Primary path: `resolveBestMctbIngressPhoneRow()` scores candidates (TeXML ingress, active config DID, platform owner boost, etc.).
- **New:** if top two candidates tie on score but differ in `workspaceId`, return `null` and log `ingress_phone_row_ambiguous`.
- `resolveInboundPhoneRowByE164()` uses scored resolution, then optional **platform-owner (`ws_1`)** row only — **no** workspace-agnostic `findFirst`.
- Global E.164 is not unique on `phone_numbers` (only `[workspaceId, e164]`); deterministic scoring + ambiguity rejection replaces “pick latest purchased.”

Platform SMS ownership (`ws_1` platform sender) and customer voice-ingress ownership remain separate concepts.

---

## G. Test results

| Command | Result |
|---------|--------|
| `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-onboarding-lifecycle-p0.ts` | **PASS** (state machine + DB: block without consent, authorize with consent, wrong workspace, STOP, duplicate send) |
| `npx tsx scripts/test-mctb-first-run-onboarding-policy.ts` | **PASS** |
| `npx tsx scripts/test-mctb-first-run-wizard-policy.ts` | **PASS** |
| `npm run test:job-queue-lifecycle` | **PASS** |
| `bash scripts/run-mctb-commercial-launch-guards.sh` | **Pre-existing guard failure** (`provisionTrialMctbNumber` regex in onboarding route — unrelated to this diff; script still exits 0) |

### Automated scenarios covered by `test-mctb-onboarding-lifecycle-p0.ts`

1. Ordinary onboarding workspace still cannot send arbitrary automatic recovery (no consent/session).
2. Valid active live-test event can send its permitted recovery message (with consent).
3. Live-test send still requires actual consent (Press-1).
4. STOP still suppresses it.
5. Exclusion: STOP/suppression path exercised (blocked).
6. Wrong workspace cannot use another workspace’s live-test authorization.
7. Random missed-call event cannot masquerade without matching session/event (blocked before consent; idempotency/duplicate after send).
8. Duplicate execution cannot send the test recovery twice (`ALREADY_SENT` / prior `smsSentAt`).
9. Live test pass without successful activation does NOT make onboarding complete (`isOnboardingComplete` unit checks).
10–12. Activation retry/success paths: state machine documented in §C; full DB activation mock not in script (gates/Telnyx).
13. Concurrent provisioning: lock module + re-check inside lock (no dedicated double-purchase integration test without Telnyx).
14. Inbound DID: unknown E.164 → `resolveBestMctbIngressPhoneRow` null; ambiguity rejection in resolver.

---

## H. Production-only verification (after push)

1. **New signup** → single ingress number under double-click / retry on provision.
2. **Full onboarding PSTN path:** CFNA → Press-1 → **one** platform recovery SMS → reply → activation → `free` + dashboard (not stuck in wizard while still `onboarding` billing).
3. **Simulated activation failure** (e.g. gate temporarily unmet): live test stays passed, onboarding UI still active, `activate_trial` retry works without redoing PSTN.
4. **Inbound call** to customer ingress DID resolves correct workspace (no cross-tenant mis-route on shared/test numbers).

**Recommended production cert scope (not full 600-click browser matrix):** new-user onboarding → provisioning → live test → activation → small PSTN golden path on changed boundaries only.

---

## Out of scope (unchanged in this pass)

Stripe checkout, landing page, own-sender A2P self-service redesign, AI Recovery redesign, analytics cleanup, voicemail GC, UI redesign, unrelated Voice V3 work.

---

## Related audit

Full read-only lifecycle audit: `docs/MCTB-CUSTOMER-LIFECYCLE-E2E-READINESS-AUDIT.md`
