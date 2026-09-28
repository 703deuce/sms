# MCTB final product functionality — gap matrix

**Status:** Gap-closing pass (extend Opus baseline — do not rebuild MCTB)  
**Baseline:** Commit `7c97075f` deployed; Sept 27 production Opus browser smoke (17/17 routes, real data). **Preserve Pure Opus shell + frozen TeXML (`mctb_texml_final_v1`).**

**Not launch certification:** UI smoke PASS ≠ commercial launch. Full functional matrix (§38) must pass before “commercially launch-certified.”

**Out of scope (unless verification fails):** PWA `manifest.webmanifest` / `sw.js` 404s; cosmetic save toasts; cooldown code changes (verify-only).

---

## Execution order (locked for this pass)

1. **Deploy + production re-test** missed-call detail (multiple real rows / states).
2. **Trace + verify** `caller_replied` → email (and matrix routing) — repair existing path; no parallel notification subsystem.
3. **Urgent AI** + Setup → Notifications UI + entitled business SMS alert (extends inbound-reply lifecycle).
4. **Verify cooldown** end-to-end → mark `MCTB_COOLDOWN_UI_RUNTIME: COMPLETE` and stop touching cooldown code.
5. **Audit** authoritative usage / free allowance (no `FREE_LIMIT = 25` hack).
6. **Audit + test** fresh-workspace ingress provisioning (not “this workspace has an 866”).
7. **Finish** sender ownership / template policy (platform vs customer-owned), including Inbox composer entitlement.
8. **Run** full functional matrix.

---

## Summary flags

| Flag | Status | Notes |
|------|--------|--------|
| `MCTB_MISSED_CALL_DETAIL` | **PARTIAL** | Loader/API fix on branch; **prod re-test** multiple row states before COMPLETE |
| `MCTB_PLATFORM_RECOVERY_TEMPLATE` | **PARTIAL** | Resolver + locked Text Back UI; certify UI → API → persistence → runtime |
| `MCTB_CUSTOMER_OWNED_RECOVERY_TEMPLATE` | **PARTIAL** | `messageTemplate` editable; certify persistence + runtime uses custom value |
| `MCTB_COOLDOWN_UI_RUNTIME` | **PARTIAL — VERIFY ONLY** | No more code unless functional test fails |
| `MCTB_REPLY_EMAIL_NOTIFICATIONS` | **PARTIAL** | Trace below; wire/repair before urgent |
| `MCTB_URGENT_AI_CLASSIFIER` | **PARTIAL** | `classifyMctbUrgentReply` + single-pass orchestration; Setup → Notifications UI + test API; prove prod email/SMS |
| `MCTB_URGENT_CONVERSATION_STATE` | **PARTIAL** | Inbox list/thread `Pill` + context; `_mctb_urgent_latest` + `mctbUrgencyAssessment`; prove after deploy |
| `MCTB_URGENT_SMS_ENTITLEMENT` | **PARTIAL — AUDITED** | `hasActiveMctbPaidEntitlement` is authoritative (no `mctb.urgent_business_sms` SKU yet); UI + runtime aligned |
| `MCTB_URGENT_RECIPIENT_VALIDATION` | **PARTIAL** | E.164 normalize/reject, dedupe, disabled filtered at send; prove save + runtime |
| `MCTB_URGENT_CLASSIFIER_FAILURE_FALLBACK` | **PARTIAL** | `classification=classifier_unavailable` → `caller_replied` notify; prove with forced LLM failure |
| `MCTB_URGENT_CHANNEL_FAILURE_ISOLATION` | **PARTIAL** | Per-channel delivery rows; email/sms loops independent; prove SMS fail + email ok |
| `MCTB_WORKSPACE_INGRESS_PROVISIONING` | **PARTIAL** | Needs **new-workspace** lifecycle proof + failure semantics |
| `MCTB_USAGE_FREE_ALLOWANCE` | **AUDIT FIRST** | Find authoritative package/entitlement/usage — do not add independent counter |
| `MCTB_CONSENT_PRESS_1` | **IMPL COMPLETE** | Frozen TeXML; historical/live evidence; preserve |
| `MCTB_CONSENT_EXISTING` | **VERIFY** | UI smoke ≠ PSTN runtime cert; launch matrix for `existing_consent` branch |
| `MCTB_END_TO_END_FUNCTIONALITY` | **MISSING** | §38 matrix not run |

---

## Recovery template — two certified paths (do not combine as one COMPLETE)

| Path | Persistence | Opus UI | Server enforcement | Runtime consumer | Certified? |
|------|-------------|---------|-------------------|------------------|------------|
| **Transovo platform sender** | `senderMode=PLATFORM`; workspace `messageTemplate` must not override outbound recovery copy | Locked preview; no free-form save of recovery body | Setup POST already strips unauthorized template; GET overlays approved copy | `resolveMctbRecoveryOpenerTemplate()` in send path | **NO** — prove PSTN/SMS + API rejection of custom copy |
| **Customer-owned sender** | `messageTemplate` in workspace/MCTB config | Editable Text Back; save persists | Policy must require entitled sender | Send uses customized `messageTemplate` | **NO** — prove edit → save → reload → outbound body |

**Policy mistake to avoid:** A single row “Text Back opener = COMPLETE” while platform lock is still PARTIAL.

**Inbox composer:** Platform sender must not allow composing recovery copy that bypasses policy — same certification tranche as template rows.

---

## Cooldown — verify-only checklist

**Do not redesign cooldown** unless a step below fails.

| Step | Expected |
|------|----------|
| 1 | Set cooldown to **3 hours** in Setup → Recovery; save |
| 2 | Hard refresh → still **3 hours** |
| 3 | Runtime reads `cooldownMinutes` (→ `cooldownSeconds` in eligibility) |
| 4 | First eligible recovery for caller A succeeds |
| 5 | Second qualifying missed call from A **inside** 3h → suppressed with **cooldown** reason (prove event/reason) |
| 6 | Outside boundary eligible again — use controlled test data/time, not literal 3h wait if possible |
| 7 | Change workspace to another duration → runtime follows new value |

**If all pass:** `MCTB_COOLDOWN_UI_RUNTIME: COMPLETE` — leave code alone.

---

## `caller_replied` notification trace (audit — settle before urgent)

**Product rule:** Urgent escalation extends this pipeline — not a second parallel notification system.

```
Inbound consumer SMS (Telnyx)
  → acceptMctbInboundSmsIngress (persist inbound + enqueue durable job)
  → processMctbInboundSmsJob
  → handleMctbCustomerSmsReply (customer-sms.ts)
       ├─ AI Lead Recovery OFF → recordMctbLeadRecoveryInboundSideEffects only (`mctb_notifications_only`)
       └─ AI Lead Recovery ON  → handleMctbLeadRecoveryInboundSms → side effects → optional outbound consumer SMS
  → recordMctbLeadRecoveryInboundSideEffects
       → urgency assessment (structured intent and/or reply text + matrix criteria)
       → recordMctbHandoffEvent(caller_replied) [idempotent per providerMessageId]
       → deliverMctbHandoffNotifications (single pass per inbound)
            → routingMatrix[eventType] from loadMctbHandoffConfig
                 (caller_replied | urgent_detected | callback_requested — not two emails for one reply)
            → email: notifyWorkspaceByEmail + mctbNotificationDelivery row
            → in_app skipped when MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY (launch default: email-only team alerts)
            → team SMS per matrix + recipient event channel policy
```

**Setup → Notifications:** Opus matrix includes `caller_replied` (`setup-pages.tsx` / `setup-notifications-model.ts`). Runtime consumer: `config.routingMatrix` in `deliverMctbHandoffNotifications`.

**Legacy path (not production customer SMS):** `processMctbInboundReply` — comment: Telnyx customer SMS does **not** call this; use `recordMctbLeadRecoveryInboundSideEffects`.

**Remaining verification (not yet closed):**

- Prove email delivery for `caller_replied` with matrix toggles and real recipient (production or integration test with `notifyWorkspaceByEmail` stub).
- Confirm idempotency per inbound (`providerMessageId` in handoff key + `mctb-notify:…:email:…`).
- **Launch flag:** `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY === true` (`src/lib/mctb/launch-flags.ts`) — `deliverMctbHandoffNotifications` skips in-app delivery; **email channel still runs** when matrix + recipient allow.
- **Do not modify** legacy `processMctbInboundReply` for production Telnyx SMS.
- **Then** urgent classifier inside orchestration (not a second notification system).

**Target orchestration (urgent tranche — one pass, no duplicate emails):**

```
Inbound reply → persist
  → caller_replied handoff event
  → urgency evaluation when Urgent Reply Alerts enabled
  → deliverMctbHandoffNotifications once
       NORMAL  → caller_replied matrix channels (email, etc.)
       URGENT  → urgent_detected (or successor) formatting + entitled business SMS
```

Today: one `deliverMctbHandoffNotifications` call picks `urgent_detected` vs `caller_replied` before send. Urgent AI tranche must keep that single-pass behavior while moving to instructions-driven classification.

---

## Urgent AI — REQUIRED THIS PASS

**Status:** `MCTB_URGENT_AI_CLASSIFIER: MISSING — REQUIRED THIS PASS` (not deferred).

### Runtime requirements (before / during implementation)

1. **Independent of conversational AI Recovery** — Urgent Reply Alerts are MCTB notification/escalation. Workspace may have MCTB on, AI Recovery off, Urgent Alerts on. Example: Press-1 → locked recovery text → caller replies “My basement is flooding” → persist → classify → business alert **without** LR conversation. **Do not** gate urgent (or `caller_replied` handoff) behind `leadRecoveryEnabled`.

2. **No extra consumer SMS from urgency** — Especially platform sender: classify → **business** notification only. Consumer messaging stays under sender ownership, template policy, consent, entitlement.

3. **Single notification orchestration (no duplicate emails)** — Reuse `caller_replied` / handoff infrastructure; no parallel stack. Preferred flow:

   ```
   Inbound reply → persist → record caller_replied lifecycle
     → urgency evaluation (when enabled)
     → notification routing (one orchestration pass)
   NORMAL  → matrix caller-replied email/channels
   URGENT  → urgent-formatted email + entitled business SMS + persisted urgent UI state
   ```

   Do **not** send both a normal reply email and a second urgent email for the same inbound message unless explicitly required. Preserve idempotency per channel.

4. **Business urgent instructions = semantic authority** — Reuse existing structured AI infrastructure where it fits. **Do not** reduce the feature to keyword-only reuse of `assessMctbUrgencyFromStructuredIntent` if that cannot answer: “Given this business’s natural-language urgent instructions, this reply, and recent context — urgent?” Return `{ urgent, reason, summary }`. If an old helper cannot express that contract, extend minimally; do not break unrelated Lead Recovery behavior.

**Known trap (caller_replied) — fixed on branch:** `handleMctbCustomerSmsReply` used to return `lead_recovery_not_enabled` before handoff. **Fixed** (`869f33b6`): handoff runs for all qualified MCTB inbound replies; Lead Recovery only gates **outbound** conversational SMS. Guard: `scripts/test-mctb-caller-replied-inbound-path.ts`.

**Reuse note:** Lead Recovery produces `StructuredLeadIntent`; that may feed urgency when LR runs, but urgency when LR is **off** must use instructions-driven classification (future tranche), not LR-only paths.

**Target contract:**

1. Inbound reply → compliance/routing → persist message  
2. `caller_replied` handoff event + orchestrated notifications (after urgency when enabled)  
3. If urgent alerts enabled → classifier → structured `{ urgent, reason, summary }` → persist  
4. If urgent → mark conversation/message visible urgent → email per config → **entitled** business SMS to emergency recipient(s)

**Configuration home:** Setup → Notifications only (no `/setup/urgent` unless architecture forces it):

- Urgent Reply Alerts ON/OFF  
- “What should Transovo consider urgent?” (instructions textarea)  
- Urgent email behavior  
- Urgent business SMS ON/OFF + recipient(s)  
- **Test Urgent Rules** — same production classifier; must NOT create consumer conversation, send consumer SMS, send real emergency alert, or mutate production conversation state; returns Urgent/Normal + concise reason

**Gap vs today:** Urgency is partially tied to Lead Recovery intent + keyword/criteria matching; product wants explicit urgent-instructions-driven AI classification on every inbound reply when enabled, with visible UI + business SMS entitlement separated from customer recovery quota.

---

## Usage / free ~25 — audit first

**Do not** introduce `FREE_LIMIT = 25` or a second counter.

| Step | Action |
|------|--------|
| 1 | Locate authoritative package, entitlement, usage accounting, billing period, enforcement |
| 2 | Document what currently counts (recoveries vs messages vs segments vs conversations) |
| 3 | Map product intent (~25 free MCTB recoveries / monthly period) onto **one** system |
| 4 | Ensure business urgent-alert SMS does **not** consume customer MCTB recovery allowance unless explicitly designed |

**Matrix status:** `AUDIT FIRST` — not MISSING with a guessed implementation.

---

## Ingress auto-provision — new workspace proof

Showing **(866) 602-0680** on an **existing** workspace does **not** certify auto-provision.

| Required proof | |
|----------------|--|
| New eligible MCTB workspace → provisioning requested → DID acquired/assigned → TeXML app/routing → workspace association → onboarding shows real forwarding target | |
| Provider failure → no fake success → no instructions to unusable DID → retryable state → no duplicate purchase on retry/refresh | |

**Status:** PARTIAL until controlled new-workspace test (or traced lifecycle doc + failure semantics).

---

## Consent — split certification

| Mode | Implementation | Runtime evidence | Matrix status |
|------|----------------|------------------|---------------|
| **Press-1** | Frozen TeXML pipeline | Historical/live PSTN evidence | Preserve; do not rewrite TeXML |
| **Existing consent** | Implementation exists | **Needs** launch lifecycle: attestation UI, entitlement, voicemail/capture/SMS on frozen branch | **VERIFY** — Consent page smoke does not certify PSTN |

---

## Gap table (feature rows)

| Feature | Backend | Persistence | Runtime consumer | Opus UI | Runtime verified | Gap | Action |
|---------|---------|-------------|------------------|---------|------------------|-----|--------|
| Pure Opus Stage 2 shell | Yes | — | — | Yes | Smoke PASS | COMPLETE | Preserve |
| Missed calls list | Yes | DB | Yes | Yes | Smoke PASS | COMPLETE | Preserve |
| Missed call detail | Yes | DB | Yes | Yes | Was FAIL prod | **PARTIAL** | Prod re-test multiple states |
| Conversations / inbox | Yes | DB | SMS | Yes | Smoke (no send) | PARTIAL | Send + entitlement |
| **Platform recovery template** | Partial | `senderMode` | `resolveMctbRecoveryOpenerTemplate` | Locked Text Back | Not proven E2E | **PARTIAL** | Certify full path |
| **Customer-owned recovery template** | Yes | `messageTemplate` | send | Editable Text Back | Not proven E2E | **PARTIAL** | Certify edit→runtime |
| Customer-owned sender / TFN / 10DLC | Yes | Numbers/A2P | send | Setup/Numbers | Not in smoke | PARTIAL | Audit upgrade |
| Recovery delay | Yes | `delaySeconds` | eligibility | Recovery | Not re-tested | PARTIAL | §37 test |
| Cooldown | Yes | `cooldownMinutes` | eligibility | Recovery dropdown | Not re-tested | **PARTIAL — verify only** | Checklist above |
| Pause / resume | Yes | schedule | `recovery_paused` | Recovery | Not in smoke | PARTIAL | Test semantics |
| Notifications / handoff | Yes | `/api/mctb/handoff` | `deliverMctbHandoffNotifications` | Setup → Notifications | Trace incomplete | PARTIAL | Verify `caller_replied` email |
| Reply email on customer reply | Partial | handoff + matrix | `recordMctbLeadRecoveryInboundSideEffects` | Matrix toggle | Not verified | PARTIAL | Trace + prove delivery |
| **Urgent AI + business SMS** | Partial | assessments + `emergencyCriteria` | `processMctbInboundReplyHandoff` | Setup → Notifications | Not E2E | **PARTIAL** | Prove classifier + entitled SMS |
| Exclusions | Yes | API | eligibility | Setup | Not in smoke | PARTIAL | Runtime proof |
| Consent Press-1 | Yes | setup + TeXML | frozen | Setup | Live evidence | **IMPL COMPLETE** | Preserve TeXML |
| Consent existing | Yes | attestation | frozen branch | Setup | Not in launch matrix | **VERIFY** | PSTN lifecycle test |
| Voicemail | Yes | API | TeXML | Inbox + setup | Empty inbox OK | PARTIAL | `existing_consent` path |
| Setup Test / live test | Yes | live-test API | ingress | Test | Not started smoke | PARTIAL | Real chain |
| Usage / free allowance | ? | billing/entitlement | ? | ? | No | **AUDIT FIRST** | No new counter |
| Ingress auto-provision | Partial | workspace | onboarding | Phone | Existing 866 only | PARTIAL | New-workspace proof |
| STOP/HELP | Yes | suppression | send gates | — | Not in smoke | PARTIAL | §38 |
| AI Recovery (conversational) | Yes | lead-recovery | SMS AI | `/mctb/ai-recovery` | Smoke PASS | PARTIAL | Distinct from urgent alert product |

---

## Code landed (branch `cursor/mctb-final-product-gaps-2304`)

| Item | Files |
|------|--------|
| Missed call detail | `missed-call-detail-load.ts`, API route, Opus detail page, adapter |
| Platform template (partial cert) | `message-template.ts`, `send.ts`, setup GET, `text-back-editor.tsx` |
| Cooldown UI options | `setup-pages.tsx`, `setup/recovery/page.tsx` |
| **caller_replied when LR off** | `customer-sms.ts` notifications-only path; side-effects idempotency |
| **Urgent AI orchestration** | `urgent-reply-classifier.ts`, `inbound-reply-handoff.ts`, `test_urgent_rules` API, Notifications UI |
| Guards | `test-mctb-caller-replied-inbound-path.ts`, `test-mctb-caller-replied-email-delivery-contract.ts`, `test-mctb-inbound-reply-notification-plan.ts` |

---

## Verification commands

```bash
npx tsx src/lib/mctb/message-template.test.ts
npx tsx scripts/test-mctb-caller-replied-inbound-path.ts
npx tsx scripts/test-mctb-caller-replied-email-delivery-contract.ts
npx tsx scripts/test-mctb-inbound-reply-notification-plan.ts
npm run verify:mctb-stage2-presentation
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

After deploy: production-click missed-call detail rows (recovery sent, suppressed, with/without conversation, older/newer).

---

## OPUS UI compliance (required before deploy)

Automated guard (must pass before deploy):

```bash
npm run verify:mctb-stage2-presentation   # PURE_OPUS, legacy imports/CSS/render = 0
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

| Surface | New functionality | Opus components/patterns reused | New component? | Reason if yes | Presentation guard | Visual/browser |
|---------|-------------------|----------------------------------|----------------|-----------------|---------------|----------------|
| Setup → Notifications | Urgent Reply Alerts, instructions, Test Urgent Rules | `Panel`, `FieldRow`, `Pill`, `Checkbox`, `Textarea`, `Button` from existing Opus mirror + `@/newui-transplant/components/ui/*` (same as Recovery/Text Back) | No — lives in `mirror/routes/mctb/setup/notifications/page.tsx` | — | PASS (run on branch) | **PENDING** post-deploy |
| Setup → Notifications | Events matrix + urgent row | Existing notifications table pattern | No | — | PASS | **PENDING** |
| Setup → Text Back | Platform template lock | `Panel`, `Pill`, `SaveBar`, `Textarea` (`text-back-editor.tsx`) | No | — | PASS | **PENDING** |
| Setup → Recovery | Cooldown options | `Panel`, `FieldRow`, `Select` (recovery page) | No | — | PASS | **PENDING** |
| Conversations urgent state | Urgent list/thread indicator + context reason | `Pill` (warning), existing inbox layout (`inbox.tsx`) | No | — | PASS (code) | **PENDING** post-deploy browser |

**Rule:** No page-local mini design system; urgent section uses the same `Panel` + `FieldRow` rhythm as Recovery/Phone setup.

---

## Functional proof evidence log (close rows only with records)

| Step | Flag(s) | Status | Evidence |
|------|---------|--------|----------|
| 1 Deploy + `/api/health` commit | — | **PENDING** | `master` @ `680105af` pushed; prod still `8c118a86` as of 2026-09-28T00:22Z — wait for Coolify |
| 2 Missed-call detail prod rows | `MCTB_MISSED_CALL_DETAIL` | **PENDING** | Row IDs, API 200, UI screenshots |
| 3 `caller_replied` real email | `MCTB_REPLY_EMAIL_NOTIFICATIONS` | **PENDING** | inbound provider ID, handoff event, `mctbNotificationDelivery`, received email |
| 4 Urgent settings persist | `MCTB_URGENT_NOTIFICATION_UI` | **PENDING** | save + hard refresh |
| 5 Test Urgent Rules UI | `MCTB_URGENT_AI_CLASSIFIER` (test path) | **PENDING** | urgent/normal samples + API JSON |
| 6 Urgent w/ AI Recovery OFF | `MCTB_URGENT_AI_CLASSIFIER` | **PENDING** | LR off, inbound reply, no consumer AI SMS |
| 7 Normal urgent-enabled reply | — | **PENDING** | single email, not urgent UI |
| 8 Urgent inbound reply | `MCTB_URGENT_EMAIL`, `MCTB_URGENT_BUSINESS_SMS` | **PENDING** | assessment row + delivery rows |
| 9 Business SMS entitlement | `MCTB_URGENT_BUSINESS_SMS` | **PARTIAL** | `canSendMctbUrgentBusinessTeamSms` → `hasActiveMctbPaidEntitlement`; runtime suppress + UI disable on `urgent_detected` SMS |
| 10 Idempotency replay | `MCTB_URGENT_IDEMPOTENCY` | **PENDING** | keys: `mctb-handoff:…:caller_replied:{providerMessageId}`, `mctb-notify:{handoffEventId}:…` |
| 11 Conversations urgent UI | `MCTB_URGENT_CONVERSATION_STATE` | **PENDING** | list `Pill`, thread header, message marker, context summary after real urgent inbound |
| 12 SMS entitlement audit | `MCTB_URGENT_SMS_ENTITLEMENT` | **PARTIAL** | `describeMctbUrgentBusinessSmsEntitlement()` — paid MCTB = entitled until granular SKU exists |
| 13 Recipient validation | `MCTB_URGENT_RECIPIENT_VALIDATION` | **PENDING** | invalid/duplicate rejected on save; caller E.164 not used as team SMS dest |
| 14 Classifier failure fallback | `MCTB_URGENT_CLASSIFIER_FAILURE_FALLBACK` | **PENDING** | LLM unavailable → `caller_replied` email + `classifier_unavailable` assessment row |
| 15 Channel failure isolation | `MCTB_URGENT_CHANNEL_FAILURE_ISOLATION` | **PENDING** | urgent email sent + SMS failed recorded; no duplicate email on SMS retry |

**Do not mark COMPLETE** until the evidence column is filled for that step.

**Urgent business SMS entitlement (audit):** No separate `mctb.urgent_business_sms` capability exists in billing today. `canSendMctbUrgentBusinessTeamSms` → `hasActiveMctbPaidEntitlement` (`PAID_MCTB_PLANS` + active Stripe subscription). Documented in `urgent-business-sms-entitlement.ts`. If product later splits tiers, wire the **existing** workspace entitlement mechanism — do not add a parallel flag store.

**Classifier failure:** When semantic LLM returns unavailable, assessment uses `classification: classifier_unavailable` (not a model “normal” decision). Notifications still use `caller_replied` routing so the business does not lose the basic new-reply alert.
