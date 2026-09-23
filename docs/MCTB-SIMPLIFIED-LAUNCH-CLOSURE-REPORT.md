# MCTB Simplified Launch — Final Closure Report

**Branch:** `cursor/mctb-simplified-launch-2304`  
**Baseline:** `40b49edbcdad8b13d470b65546ab31650d9bc90e` (PR #483 merged)  
**Draft PR:** #484

---

## Closure pass code changes

| File | Change |
|------|--------|
| `src/lib/agents/missed-call-text-back/customer-sms.ts` | STOP/opt-out runs **before** Lead Recovery enabled gate |
| `src/lib/mctb/handoff/recipient-event-routing.ts` | `defaultNewMctbNotificationRecipientEventChannels()` + save normalizer |
| `src/lib/mctb/handoff/config.ts` | New creates persist explicit email event defaults |
| `src/components/mctb/setup/setup-notifications-view.tsx` | “+ Add recipient” seeds explicit defaults in UI |
| `src/components/mctb/setup/mctb-recovery-goal-setup-section.tsx` | Documented future sender-mode gate hook (`data-mctb-recovery-opener-editor`) |
| `scripts/test-mctb-simplified-launch.ts` | STOP ordering + new-recipient default assertions |

---

## 3. AI Replies — full runtime trace

| Step | File / symbol |
|------|----------------|
| UI toggle | `src/components/mctb/setup/setup-notifications-view.tsx` → `setLaunchAiReplies()` |
| API | `POST /api/mctb/handoff` → `src/app/api/mctb/handoff/route.ts` (`action: set_launch_ai_replies`) |
| Persist LR + handoff | `src/lib/mctb/launch-lead-recovery.ts` → `applyLaunchAiRepliesSetting()` → `saveLeadRecoveryConfig()` + `saveMctbHandoffConfig()` |
| LR storage | `workspace.customFieldsConfig.mctb.leadRecovery` via `src/lib/mctb/lead-recovery/config.ts` |
| Inbound accept | `acceptMctbInboundSmsIngress()` → `src/lib/mctb/messaging/inbound-sms-ingress.ts` |
| Worker | `processMctbInboundSmsJob()` → `src/lib/mctb/messaging/process-inbound-sms-job.ts` |
| MCTB SMS gate | `handleMctbCustomerSmsReply()` → `src/lib/agents/missed-call-text-back/customer-sms.ts` |
| LR turn | `handleMctbLeadRecoveryInboundSms()` → `src/lib/mctb/lead-recovery/conversation-runtime.ts` |
| Intent | `runLeadRecoveryIntentAgent()` + `buildMctbSemanticConversationContext()` |
| Policy | `evaluateLeadRecoveryPolicy()` / `evaluateLeadRecoveryPolicyMulti()` → `policy-engine.ts` |
| Actions | `executeLeadRecoveryActions()` → `action-runtime.ts` |
| Outbound | durable: `enqueueMctbCustomerOutboundSmsJob()`; inline: `sendMctbCustomerOutboundSms()` |

Launch ON sets `actionCapabilities` **without** `AI_BOOK`, and `defaultIntentPolicies("SEND_BOOKING_LINK")` for booking intents.

---

## 4. AI Replies OFF — ordinary inbound reply

1. Inbound SMS is still accepted and stored (`acceptMctbInboundSmsIngress`).
2. `handleMctbCustomerSmsReply`: after STOP check, `loadLeadRecoveryConfig` → `enabled === false` → `{ handled: false, reason: "lead_recovery_not_enabled" }`.
3. Worker does **not** retry (`lead_recovery_not_enabled` ∉ `RETRYABLE_REASONS`); no automated reply.
4. `responseMode` / legacy handoff alone does **not** run parallel SMS automation in this path.

## 5. AI Replies ON — FAQ (“What time do you close?”)

**SOURCE GAP (launch promise):**

- Intent LLM can classify `BUSINESS_HOURS` / `BUSINESS_FAQ` (`intent-agent.ts`).
- Launch toggle sets `faqPolicy.topics` but **`faqPolicy` is not read** in policy/action runtime for answer text.
- `ANSWER_APPROVED_INFORMATION` in `action-runtime.ts` is a stub (`"What would you like to know?"`).
- `applyLaunchAiRepliesSetting` uses `defaultEnabledScenarios()` with **`general_faq: false`** — FAQ intents are not in the enabled scenario set unless changed elsewhere.
- `buildMctbSemanticConversationContext` supplies thread + structured state only — **no approved business knowledge payload**.

**Observed behavior today:** FAQ-like messages may get intent classification, then **fallback / generic `CUSTOMER_MESSAGE` templates** from `policy-defaults` / `fallbackPolicy` — not grounded store hours.

## 6. AI Replies ON — booking intent

1. Intent → `BOOKING_REQUEST` (or availability/time variants).
2. Policy from `defaultIntentPolicies("SEND_BOOKING_LINK")` → actions `["SEND_BOOKING_LINK"]`.
3. `isActionPermitted("SEND_BOOKING_LINK", config)` → true (in launch capabilities).
4. `isActionPermitted("AI_BOOK", config)` → **false** (not in `LAUNCH_ACTION_CAPABILITIES`).
5. `executeLeadRecoveryActions` → `SEND_BOOKING_LINK` → `resolveBookingUrl()` → SMS `"Book here: {url}"`.
6. `delegateAiBooking` path requires `AI_BOOK` in policy + permitted; launch profile blocks selection.

`AI_BOOK` backend remains in repo; not exposed in launch action set.

## 7. STOP / opt-out ordering

1. **`handleMctbCustomerSmsReply` (first):** `isCarrierProtocolOptOutMessage` → `recordMctbInboundSmsOptOut` → `{ handled: true, action: "opted_out" }` — **before** LR enabled check (closure fix).
2. **LR path (when ON):** `OPT_OUT` intent → `SUPPRESS_CONTACT` / suppression upsert in `conversation-runtime.ts`.
3. AI Replies cannot bypass STOP: opt-out is handled before LR gate; LR policies still include `OPT_OUT`.

## 8. Human / terminal state

- `customer-sms.ts`: `mctbConversationAutomationState` `human_active` \| `resolved` → `{ handled: true, action: "human_handling" }` (no LR auto-reply).
- LR: `ESCALATE_HUMAN`, `emitMctbHumanRequiredHandoff`, safe fallback paths in `conversation-runtime.ts`.
- Single engine: no parallel toggle-specific conversation runtime.

## 9. New-recipient notification defaults

**Explicit default set (new creates only):**  
`caller_replied`, `lead_captured`, `callback_requested`, `urgent_detected`, `human_required`, `appointment_booked` — each `{ email: true, sms: false, in_app: false }` (keys of `DEFAULT_ROUTING_MATRIX`).

**Legacy:** existing rows with `{}` still get email-on via `recipientAllowsNotificationChannel` when `prefs` missing.

## 10. Recovery opener — future PLATFORM/CUSTOMER gating

| Layer | Location |
|-------|----------|
| UI (advanced) | `MctbRecoveryGoalSetupSection` — `data-mctb-recovery-opener-editor`, textarea bound to `messagePreview` |
| Setup API | `POST /api/mctb/setup` `messageTemplate` → `initial_message` |
| Persistence | `updateMissedCallTextConfig` / missed-call-text-back config |
| Goals | `applyMctbRecoveryGoalConfiguration` when goal changes |

Future sender mode can gate the advanced block + API write without changing recovery architecture.

## 11. Four recovery goals (from code)

| Goal | Initial message | Request form | Link | AI (inbound, launch toggle) |
|------|-----------------|--------------|------|-----------------------------|
| Get a reply | `recovery-goals.ts` default opener; overridable via `messageTemplate` | `[]` | Opener may include `{{link}}` only if user edits | LR when toggle ON; opener unrelated |
| Request a callback | callback-oriented default opener | name, phone, callback_time, help | No `usesBookingLink` | LR + `CREATE_CALLBACK_REQUEST` policies when ON |
| Collect details | opener includes `{{link}}` | name, phone, email, need | Request form link in template | LR when ON |
| Book an appointment | opener includes `{{link}}`; `usesBookingLink: true` | name, phone, appointment_notes | **Recovery opener link** via template resolution; inbound booking → `SEND_BOOKING_LINK` not `AI_BOOK` | LR booking intents → `SEND_BOOKING_LINK` |

## 12. Voicemail — four paths

| Path | UI | API | Persistence | Preview | Activation |
|------|----|-----|-------------|---------|------------|
| Transovo default (onboarding) | `OnboardingVoicemailStep` “Use Transovo default” | `mark_voicemail_configured` only — **no** custom `greetingUrl`/`greetingText` | onboarding state timestamp | N/A | Platform TeXML/runtime default greeting — **not** custom box |
| Transovo voice (TTS / ElevenLabs) | `MctbVoicemailSetupSection` → `PersonalGreetingControls` voiceSource `create` | `/api/phone/voicemail` `ensure_number_box`, `update_box` | `greetingText` on voicemail box | TTS preview in controls | `persistGreeting` on save |
| Record | `PersonalGreetingControls` `record` | upload/save via same voicemail API | `greetingUrl` | record preview | save activates |
| Upload | `PersonalGreetingControls` `upload` | same | `greetingUrl` | audio preview | save activates |

**Platform default ≠ custom active:** onboarding default path does not call `update_box`; studio shows “No custom greeting yet” until user saves custom audio/text.

## 13. Try It references

| Category | Examples |
|----------|----------|
| **Dormant backend** | `/api/mctb/try-it`, `lib/mctb/try-it/*`, onboarding import of `startMctbTryItSession` |
| **Admin/internal** | `shouldShowTryItNav` true only for platform admin when `MCTB_LAUNCH_TRY_IT_ENABLED=false`; `/voice/try-it` route still exists |
| **Customer launch (gated off)** | Nav Try It hidden for normal users; onboarding demo modal `hidden={!MCTB_LAUNCH_TRY_IT_ENABLED}`; `setup-test-view` no `/api/mctb/try-it` |
| **Dead / non-route customer copy** | `src/components/mctb/setup-view.tsx` Try It strings — **not imported** by `/mctb/setup/*` pages |

**Customer-visible synthetic Try It entry from launch surfaces:** **0** (admin-only nav exception).

## 14. Legacy call-handling mutation reachability

| Entry | Reachable by normal customer UI? |
|-------|----------------------------------|
| `POST /api/numbers/[numberId]/call-handling` | **No** — `CallHandlingModePanel` read-only; no fetch to this route |
| `POST /api/call-handling` | **Yes** — canonical PR #483 switcher on MCTB Overview / shell |
| Scripts / SR builder | Internal/dev |

## 15. Regression results

All requested scripts: **PASS** (including updated `test-mctb-simplified-launch.ts`).

`npm run verify:mctb-final-pipeline`: **environment failure** (reference DID on AI Direct / non-cert TeXML) — same as Pass 2; not changed in this pass.

## 16. Zero-loss vs `40b49edb`

No changes in closure pass to: PR #483 call-handling core, TeXML pipeline, Voice V3 ingress, Press-1 / existing-consent, eligibility, suppression, sender routing libs. Branch diff remains simplified-launch UI/flags/handoff/LR toggle only (+ closure fixes above).

## 17. Unresolved simplified-launch gaps

1. **FAQ / approved business knowledge** not connected to outbound SMS text under AI Replies ON (see §5).
2. **`/voice/try-it` page** still routable if URL known — nav gated, not deleted.
3. **`setup-view.tsx`** legacy Try It copy (orphan component).

---

**Verdict:** **NOT READY — SOURCE GAP(S) REMAIN** (FAQ/knowledge path for AI Replies ON; merge decision should treat booking link + STOP + notifications defaults as verified).
