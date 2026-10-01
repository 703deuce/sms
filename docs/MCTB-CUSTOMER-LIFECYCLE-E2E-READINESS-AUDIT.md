# MCTB complete customer lifecycle — end-to-end readiness audit (read-only)

**Audit type:** Read-only architecture / code / backend readiness  
**Branch inspected:** `master` (code trace at time of audit)  
**Date:** 2026-10-01  

**Explicitly not performed:** Production mutations, PSTN calls, SMS, number provisioning, TFV/A2P submit, DB writes, deploys, or fixes.

**Method:** Trace Customer UI → API → validation/auth → DB → queue/worker → provider → runtime → UI readback. Classifications: **READY** | **PARTIAL** | **BLOCKED** | **EXTERNAL GATE** | **ENTITLEMENT GATE** | **UNKNOWN — REQUIRES LIVE PROOF**.

---

## 1. Executive verdict

### Can a brand-new customer self-serve from signup to live MCTB today?

**PARTIAL — with P0 gaps that can block the designed onboarding → live path**

### Why (code-level)

1. **Onboarding billing plan vs recovery SMS (P0)**  
   - Voice/MCTB signup sets `billingPlan: "onboarding"` (`src/app/api/auth/signup/route.ts`).  
   - `getMctbEntitlement()` sets `serviceStatus: "ONBOARDING"` and **`canSendAutomaticRecovery: false`** unless `limits.adminUnlimitedMctb` (`src/lib/mctb/entitlement.ts`).  
   - `evaluateMissedCallTextEligibility()` enforces that for non-`demoMode` sends (`src/lib/agents/missed-call-text-back/eligibility.ts`).  
   - Live test requires real `smsSentAt` on a missed-call event (`src/lib/mctb/onboarding/live-test.ts`).  
   - `activateMctbTrial()` requires `liveTestPassed` before moving plan to `"free"` and setting `mctbServiceStatus: "ACTIVE"` (`src/lib/mctb/onboarding/trial.ts`).  
   - **Closed loop:** live test needs SMS; SMS blocked on `onboarding` plan until activation moves plan off onboarding.

2. **“Ready” before activation succeeds (P0 product/state)**  
   - `markLiveTestPassed()` sets `currentStep: "ready"` then calls `activateMctbTrial()` **without rolling back** on failure (`src/lib/mctb/onboarding/live-test.ts`).  
   - `isOnboardingComplete()` treats **`ready` as complete** even without `trialActivatedAt` (`src/lib/mctb/onboarding/state.ts`).  
   - First-run wizard can stop auto-opening while activation/trial gates still fail.

3. **Strong connected paths**  
   - Toll-free TeXML ingress: `ensureMctbWorkspaceIngressReady` → `provisionMctbWorkspaceTollFreeIngress`.  
   - TeXML entry: `src/app/api/telnyx/voice/mctb-entry/route.ts`.  
   - Forwarding verification from real `missedCallEvent` metadata (`forwarding-verification.ts`).  
   - Capture/eligibility: `src/lib/mctb/capture/*`.  
   - Durable SMS jobs: `john_mctb_send`, `mctb_send_customer_sms`, `mctb_process_inbound_sms`.  
   - Notifications: `mctbHandoffConfig` + `/api/mctb/handoff`.  
   - Capabilities: `resolveMctbCapabilities`.

4. **Always EXTERNAL GATE / UNKNOWN**  
   Customer CFNA, real Press-1 DTMF, handset SMS/delivery, per-workspace TFV when not on platform sender, Telnyx inventory/purchase in production.

---

## 2. Customer lifecycle matrix (scenarios 1–50)

| # | Workflow | UI | API | DB | Queue/Worker | Provider | Runtime | Readback | Status | Exact gap |
|---|----------|----|-----|----|--------------|----------|---------|----------|--------|-----------|
| 1 | Signup → first MCTB workspace | Signup, `/mctb` | `/api/auth/signup`, `ensureMctbWorkspaceBootstrap` | `workspace`, `customFieldsConfig.mctbOnboarding`, entitlements | — | — | First-run policy | Wizard host | PARTIAL | MCTB bootstrap only when `productIntent === "voice"` |
| 2 | Business phone number | Wizard/setup phone | Onboarding POST, `persistMctbWorkspaceBusinessLineE164` | `businessNumberE164` | — | — | Forwarding verify | Setup | READY | Legacy self-attest forwarding rejected |
| 3 | Auto number provisioning | Wizard, numbers | `ensureMctbWorkspaceIngressReady`, toll-free provision | `phoneNumber`, onboarding ingress fields | optional registration jobs | Telnyx pool/purchase, TeXML | `setActiveCallHandler(mctb)` | Phone UI | PARTIAL | Idempotent checks; weak lock on concurrent purchase |
| 4 | Consent mode | Setup/wizard consent | `/api/mctb/setup`, onboarding | `consentMode`, attestation | TeXML jobs | TeXML entry | config-cache | Detail/setup | PARTIAL | Press-1 wired; negative paths U without PSTN |
| 5 | Text-back configuration | `/mctb/setup/text-back` | `/api/mctb/setup` | `missedCallTextConfig` | — | PLATFORM/WORKSPACE | send path | Editor/preview | PARTIAL | Template lock on platform mode |
| 6 | Voicemail configuration | Setup voicemail | voicemail APIs | greeting refs, storage | — | TeXML, Storage | play URLs | Inbox | PARTIAL | Storage failure on call U |
| 7 | Notification recipients | Setup notifications | `/api/mctb/handoff` | handoff config + recipients | handoff delivery | Brevo | `deliverMctbHandoffNotifications` | GET | PARTIAL | Event→notify U for all types in prod |
| 8 | Connect business phone (CFNA) | Phone setup | `startForwardingVerificationTest` | `forwardingTestStartedAt` vs `forwardingConnectedAt` | — | — | `forwardedFrom` metadata | Verification UI | READY | Connected only on verified forward |
| 9 | First forwarded call | — | TeXML ingress | `missedCallEvent` | durable voice ops | Telnyx | `resolveInboundPhoneRowByE164` | Missed calls | PARTIAL | E.164 fallback findFirst edge risk |
| 10 | Press-1 live call | — | mctb-entry, gather | consent events | — | Telnyx DTMF | consent before SMS | Consent log | UNKNOWN | Code present; PSTN proof required |
| 11 | Recovery SMS | — | capture → process | `missedCallEvent`, messages | `john_mctb_send` | Telnyx/Twilio | eligibility | Recovery column | PARTIAL | Blocked on onboarding plan |
| 12 | Caller replies | Conversations | inbound webhooks | threads | `mctb_process_inbound_sms` | Telnyx | inbound ingress | Inbox | PARTIAL | STOP/HELP U duplicate webhooks |
| 13 | Onboarding live test | Wizard test | live-test, onboarding GET | `liveTestSession` | — | — | event-derived | Test UI | BLOCKED/PARTIAL | SMS may be entitlement-blocked |
| 14 | Trial activation | Wizard finish | `activateMctbTrial` | limits, `billingPlan: free` | — | — | `mctbServiceStatus` | Overview | PARTIAL | `ready` before failed activate |
| 15 | Ordinary post-onboarding missed call | Operational | same as 11 | same | same | same | no onboarding-only flag | Dashboard | PARTIAL | Needs ACTIVE/free plan |
| 16 | Missed Calls UI | `/mctb/missed-calls` | list/detail APIs | `missedCallEvent` | — | — | runtime status | Table/detail | READY | — |
| 17 | Conversations | `/mctb/conversations` | messaging APIs | threads | in/out jobs | provider | eligibility on send | Inbox | PARTIAL | Verify all send routes gated |
| 18 | Change consent post go-live | Setup consent | setup API | config + TeXML mode | — | TeXML | mode provision | Setup | PARTIAL | History not rewritten (intended) |
| 19 | Pause/resume recovery | Setup recovery | setup PATCH | schedule | — | — | `schedule-shared` | Overview | READY | Timed expiry in schedule-shared |
| 20 | Exclusions | Setup exclusions | `/api/mctb/exclusions` | `suppression` | — | — | eligibility | Table | READY | Workspace-scoped |
| 21 | Change text-back post go-live | Text-back editor | setup | `missedCallTextConfig` | — | — | send reads config | Reload | PARTIAL | Platform template lock |
| 22 | Change voicemail post go-live | Setup voicemail | voicemail APIs | DB + Storage | — | Storage | next call play | Inbox | PARTIAL | Old object cleanup not fully traced |
| 23 | Change notifications post go-live | Notifications | handoff POST | recipients | handoff | Brevo | next event | GET | READY | Urgent SMS entitlement-gated |
| 24 | Booking links | Setup links | booking-links API | link rows | — | — | template in send | Preview | ENTITLEMENT GATE | Paid/AI capability |
| 25 | AI Lead Recovery | AI recovery UI | lead-recovery, handoff | config | AI jobs | LLM | inbound processor | Overview | PARTIAL | AI SKU required |
| 26 | Own sender / A2P | Own sender panel | setup + admin intake | customFields intake | — | manual admin | WORKSPACE sender | Status | EXTERNAL/PARTIAL | Not full self-serve carrier |
| 27 | Platform messaging readiness | Compliance UI | TFV sync | TFV + phone settings | registration jobs | Telnyx/TFV | PLATFORM sender | TFV labels | EXTERNAL/PARTIAL | Separate from ingress TFN |
| 28 | Plan upgrade | Billing | Stripe → subs/limits | subscriptions | — | Stripe | commercial entitlements | Capabilities | PARTIAL | Next-request refresh |
| 29 | Plan downgrade | — | entitlement resolver | config retained | — | — | runtime gates | UI may show stale | PARTIAL | Fail-safe at runtime |
| 30 | Usage limit | Overview | capabilities usage | usage counters | — | — | eligibility limit | Display | PARTIAL | Concurrency U |
| 31 | STOP / opt-out | — | inbound SMS | suppression | inbound job | provider | platform + workspace | thread events | PARTIAL | Compliance-critical U |
| 32 | HELP | — | keyword handlers | messages | inbound job | provider | keyword path | thread | UNKNOWN | — |
| 33 | Disable MCTB | Setup | `enabled` patch | config | queued jobs | — | FEATURE_DISABLED | Overview | PARTIAL | In-flight jobs re-check |
| 34 | Change business number | Phone setup | persist line | onboarding | — | — | re-verify | Setup | PARTIAL | Re-cert forwarding |
| 35 | Replace Transovo number | Numbers (limited) | `/api/mctb/numbers` | phone rows | reprovision | Telnyx | ingress | Phone UI | PARTIAL | Not full swap product |
| 36 | Failed SMS | — | send job | message status | retry | callbacks | send updates | failed state | PARTIAL | Duplicate delivery U |
| 37 | Webhook duplicates | — | ingress | idempotency keys | job keys | retries | dedup capture | — | PARTIAL | Not uniform all webhooks |
| 38 | Redis/worker down | — | enqueueJob | job_queue | BullMQ sync | — | job-handlers | eventual | PARTIAL | Some non-MCTB Redis-only U |
| 39 | Redeploy mid-flight | — | — | DB | reclaim | retries | idempotent handlers | — | UNKNOWN | — |
| 40 | Storage failure | Voicemail UI | upload | refs | — | Supabase | TeXML fallback | errors | PARTIAL | Graceful degrade U |
| 41 | Analytics | `/mctb/analytics` | analytics APIs | aggregates | — | — | KPI sources | charts | PARTIAL | Test traffic contamination U |
| 42 | Consent log | compliance consent | consent-log API | consent events | — | — | Press-1 ledger | table | PARTIAL | Mode vs attestation distinction |
| 43 | Voicemail inbox | `/mctb/voicemail` | voicemail APIs | recordings | — | Telnyx callbacks | inbox | playback | UNKNOWN | Live record/transcript |
| 44 | Daily digest | — | — | — | — | — | — | — | N/A | Event email handoff only traced |
| 45 | Multi-tenant isolation | MCTB pages | requireSession | workspaceId on rows | payload ws | — | — | — | PARTIAL | E.164 fallback edge |
| 46 | Second workspace | switcher | per-ws APIs | isolated config | — | — | per-ws phones | — | READY | ws_1 = platform owner only |
| 47 | Logout/login | — | session | server state | — | — | API reload | — | READY | Not localStorage-only setup |
| 48 | Return mid-onboarding | wizard | onboarding GET | persisted steps | idempotent ingress | — | resume | wizard | READY | — |
| 49 | Retry provisioning | wizard/numbers | provision actions | reuse existing | — | Telnyx | errors in UI | — | PARTIAL | Orphan provider numbers U |
| 50 | Full day-2 journey (50 steps) | chained | chained | chained | chained | CFNA+SMS | chained | chained | PARTIAL | Steps 11–14 at risk; P0 onboarding SMS |

---

## 3. Complete blocker list

### P0 — prevents new customer becoming live (code)

| ID | Issue | Evidence |
|----|--------|----------|
| P0-1 | Live test / activation requires recovery SMS while `billingPlan: onboarding` forbids automatic recovery SMS | `entitlement.ts`, `live-test.ts`, `trial.ts`, `eligibility.ts` |
| P0-2 | `currentStep: ready` + `isOnboardingComplete()` true when `activateMctbTrial()` fails | `live-test.ts` `markLiveTestPassed`; `state.ts` `isOnboardingComplete` |
| P0-3 | Customer CFNA + real Press-1 + SMS | EXTERNAL; required for designed wizard |

### P1 — live but major broken / misleading

| ID | Issue |
|----|--------|
| P1-1 | Provisioning concurrency: idempotent checks but weak locking on Telnyx purchase |
| P1-2 | `activate_trial` POST sets `currentStep: ready` vs `complete` ambiguity (`onboarding/route.ts`) |
| P1-3 | Own-sender A2P: admin/manual path — not full self-serve carrier lifecycle |
| P1-4 | AI Recovery / urgent SMS entitlement-gated — easy UI/runtime mismatch |

### P2 — secondary

| P2-1 | Analytics may include test/onboarding traffic — rules not fully traced |
| P2-2 | Inbound E.164 fallback `findFirst` if ingress resolver misses |
| P2-3 | Voicemail Storage cleanup / partial failure UX |

---

## 4. Dead / fake UI (code-suspect)

| Control / surface | Issue |
|-------------------|--------|
| Legacy “I’ve set up forwarding” without test | API 400 — good if UI respects it |
| “You’re ready” at `ready` step | Can show before `trialActivatedAt` / failed activation |
| Existing consent when product inactive | Runtime may block sends |
| Booking links / AI on free tier | API 403 on some toggles — verify all entry points |
| Try It vs CFNA live test | Distinct paths — customer confusion risk |

---

## 5. Async job audit (MCTB)

| Job | Producer | DB outbox | BullMQ queue | Worker registered | Handler | Idempotent | Retry | Result |
|-----|----------|-----------|--------------|-------------------|---------|------------|-------|--------|
| `john_mctb_send` | `schedule.ts` / process | `enqueueJob` | default/mctb | `job-handlers.ts` | `executeMissedCallTextSend` | missed-call keys | maxAttempts | SMS + event |
| `mctb_send_customer_sms` | `enqueue-customer-outbound-sms.ts` | yes | mctb | yes | `send-customer-sms-job.ts` | idempotencyKey | yes | outbound SMS |
| `mctb_process_inbound_sms` | `inbound-sms-ingress.ts` | transactional | mctb | yes | `process-inbound-sms-job.ts` | yes | yes | reply/STOP/AI |
| `mctb_durable_operation_process` | durable-operations/create | yes | mctb | yes | durable-operations worker | operation id | yes | voice steps |
| `mctb_texml_existing_consent_capture` | existing-consent-capture | enqueueJob | — | job-handlers | TeXML worker | CallSid | yes | SMS capture |
| `mctb_worker_smoke` | ops | yes | mctb | yes | smoke | timeboxed | — | health |

---

## 6. Provider integration audit

| Provider | Role | Code status | Prod config |
|----------|------|-------------|-------------|
| Telnyx | Voice TeXML, ingress DIDs, SMS, purchase/pool | READY/PARTIAL | TeXML app, API keys, pool — EXTERNAL |
| Twilio | TFN trial fallback | PARTIAL path | Live Twilio for fallback |
| Supabase | Postgres + Storage | READY schema | Bucket policies EXTERNAL |
| Brevo | Handoff email | `sendTransactionalEmail` | API key EXTERNAL |

---

## 7. Entitlement matrix (summary)

| Capability | Onboarding / free | Paid Recovery | Own sender A2P | AI Recovery SKU |
|------------|-------------------|---------------|----------------|-----------------|
| Press-1 | UI yes; send blocked until ACTIVE | yes | yes | yes |
| Existing consent | G: attestation + product | yes | yes | yes |
| Platform sender SMS | Intended (Transovo TFV) | yes | fallback | yes |
| Booking links | G off | on | on | on |
| Custom templates / 2-way | off | off until own approved | on when approved | on when approved |
| Monthly recovery limit | free tier | paid limits | same | higher with AI |
| Urgent email/SMS to team | off | off | off | G on |

**UI gate:** `resolveMctbCapabilities`. **Server gate:** `assertMctbCapability`, `getMctbEntitlement`, eligibility.

---

## 8. New-customer state machine (actual)

```
signup (billingPlan: onboarding)
  → mctbOnboarding seeded (consentMode press_1)
  → ingress provision (workspaceTollFreeNumber)
  → wizard steps (business_line → consent → recovery → voicemail → notifications → connect_calls)
  → forwardingTestStartedAt
  → forwardingConnectedAt (verified missed call, forwardedFrom = business line)
  → review_test / liveTestSession
  → liveTestPassedAt (requires SMS + reply in code)
  → currentStep: ready (even if activate fails)  ← defect
  → activateMctbTrial → billingPlan: free, mctbServiceStatus: ACTIVE, currentStep: complete
  → operational
```

**Ambiguous:** `ready` without `trialActivatedAt`; `onboardingComplete` true while activation missing.

---

## 9. Day-2 settings matrix (abbreviated)

| Setting | UI save | DB | Reload | Runtime reader | Next-event effect | Entitlement | Status |
|---------|---------|----|--------|----------------|-------------------|-------------|--------|
| MCTB enabled | setup | `missedCallTextConfig.enabled` | yes | eligibility | immediate | product | READY |
| Recovery message | text-back | config + templates | yes | send.ts | next SMS | platform lock | PARTIAL |
| Consent mode | consent | onboarding + TeXML | yes | texml cache | next call | existing G | PARTIAL |
| Pause recovery | recovery | schedule | yes | schedule-shared | suppress | — | READY |
| Exclusions | exclusions | suppression | yes | eligibility | suppress | — | READY |
| Notification recipients | handoff POST | recipient table | GET | notifications.ts | next handoff | urgent G | READY |
| Sender mode | setup/numbers | config | yes | send + capabilities | next SMS | own sender G | PARTIAL |
| AI recovery toggles | AI/handoff | lead-recovery + handoff | yes | inbound reply | next reply | AI SKU G | PARTIAL |

---

## 10. Tenant-isolation findings

- Most `/api/mctb/*` use `requireSession()` → `auth.workspaceId`.
- **Watch:** `resolveInboundPhoneRowByE164` fallback `findFirst` by E.164 without workspace.
- **Watch:** Platform STOP on shared platform sender — intentional; must not leak tenant data.
- **`ws_1`:** Platform owner workspace for platform SMS (`MCTB_PLATFORM_OWNER_WORKSPACE_ID_DEFAULT`), not customer default.

---

## 11. Disaster / retry findings

- Durable outbox: `enqueueJob` → `job_queue`; idempotency keys; inbound SMS transactional + BullMQ wake.
- MCTB voice: `durable-operations` for TeXML path.
- **Gaps:** Telnyx purchase + DB not one atomic transaction; webhook idempotency not uniform.

---

## 12. Real-world certification (minimal)

1. New signup → ingress TFN (Telnyx prod).
2. CFNA business line → workspace ingress.
3. Press-1 + DTMF 1 → consent; no SMS without consent.
4. Recovery SMS (PLATFORM) during/after onboarding — validates P0-1.
5. Inbound reply → conversation.
6. STOP → next automated send suppressed.
7. Voicemail record + playback (+ transcript if enabled).
8. Brevo handoff email on qualifying event.
9. Delivery callback → message state.
10. Worker/Redis outage → job completes after recovery.

---

## 13. Final answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Self-serve without staff? | **Partial** — onboarding SMS loop + activation state |
| 2 | Auto provision number? | **Yes in code**; **U** prod inventory |
| 3 | CFNA themselves? | **Yes** instructions + verify; **E** carrier |
| 4 | Press-1 effective automatically? | **U** — code yes |
| 5 | First recovery SMS? | **Partial** — onboarding plan may block |
| 6 | Reply + conversation? | **Partial** — pipeline yes; **U** live |
| 7 | Activates trial? | **Partial** — can fail while UI `ready` |
| 8 | Change all core settings? | **Mostly yes** with gates |
| 9 | Runtime uses changes? | **Mostly yes** |
| 10 | Upgrade → capabilities? | **Yes** on next resolve |
| 11 | Downgrade safe? | **Partial** — runtime gates |
| 12 | STOP suppresses? | **Partial** — **U** compliance |
| 13 | Redis interruption recovery? | **Partial** — key MCTB jobs |
| 14 | Durable records? | **Yes** Postgres for core domain |
| 15 | Staff intervention? | **Yes for:** own-sender A2P admin, provisioning failures, external gates, possible P0 policy fix |

---

## Special audit — carrier approval vs instant onboarding

**Design intent:** Voice on workspace Telnyx TFN; **SMS via PLATFORM sender** (`ensureMctbPlatformSenderDefault`). TFV on ingress TFN is not the SMS path for platform mode. Trial gates skip TFV when `usesPlatformSender`.

| Action | Before per-customer TFV (platform sender) |
|--------|-------------------------------------------|
| Receive forwarded call | EXTERNAL (CFNA + Telnyx) |
| Hear Press-1 | UNKNOWN |
| Record consent | UNKNOWN |
| Voicemail | UNKNOWN |
| Missed-call record | READY once call hits ingress |
| Test recovery SMS | BLOCKED/PARTIAL — likely blocked on `onboarding` plan |
| Inbound reply | PARTIAL if outbound sent |
| Complete live test | BLOCKED/PARTIAL |
| Activate trial | After live test gates |
| Ordinary recovery SMS | After `activateMctbTrial` → `free` + ACTIVE |

**Where carrier approval blocks:** `WORKSPACE` sender via TFV/A2P (`trial-gates.ts`).

**Architecture tension:** Platform sender should allow onboarding SMS without per-customer TFV, but **`getMctbEntitlement` ONBOARDING block** contradicts live test. Likely needs explicit onboarding send allowance or activate free plan before live test — product decision, not implemented in this audit.

---

## Key file references

| Area | Paths |
|------|--------|
| Signup / bootstrap | `src/app/api/auth/signup/route.ts`, `src/lib/mctb/provisioning/workspace-bootstrap.ts`, `seed-workspace.ts` |
| Ingress provision | `ensure-workspace-ingress.ts`, `provision-workspace-toll-free-ingress.ts`, `trial-number.ts` |
| Entitlement / trial | `src/lib/mctb/entitlement.ts`, `onboarding/trial.ts`, `trial-gates.ts` |
| Live test / activation bug | `onboarding/live-test.ts`, `onboarding/state.ts` (`isOnboardingComplete`) |
| Eligibility / SMS | `agents/missed-call-text-back/eligibility.ts`, `mctb/capture/handle.ts` |
| TeXML | `src/app/api/telnyx/voice/mctb-entry/route.ts`, `lib/mctb/texml-ingress/*` |
| Forwarding verify | `onboarding/forwarding-verification.ts` |
| Notifications | `src/app/api/mctb/handoff/route.ts`, `lib/mctb/handoff/*` |
| Jobs | `lib/jobs/job-handlers.ts`, `lib/jobs/job-priority.ts`, `lib/messaging/enqueue-advance.ts` |
| Capabilities | `src/lib/mctb/capabilities.ts`, `commercial-entitlements.ts` |
| Tenant resolve | `src/lib/phone/resolve-inbound-e164.ts` |

---

*End of audit document.*
