# MCTB Setup — Connectivity & Runtime Audit

**Companion:** `docs/MCTB-SETUP-SCREEN-INVENTORY.md` (what is on each screen).

**Method:** Code-path trace UI → API → persistence → runtime (TeXML ingress, `evaluateMissedCallTextEligibility`, SMS send, handoff, voicemail). Ratings are **code completeness**, not PSTN/live certification unless noted.

**Date:** 2026-09-22 · **Baseline:** `master` (post inventory commit).

---

## Rating legend

| Rating | Meaning |
|--------|---------|
| **Complete** | Control or readout is wired end-to-end: saves or loads real state, and runtime (or test harness) uses the same source of truth. |
| **Partial** | Wired for some paths, display-only, duplicate surface, missing save, missing sync step, or requires live provider / manual phone to prove. |
| **Not connected** | No backend, dead control, or UI implies behavior the runtime does not implement. |

**Runtime anchors (do not duplicate):**

- Voice ingress: frozen TeXML pipeline (`docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`) — `press_1` vs `existing_consent`.
- Recovery SMS: `src/lib/agents/missed-call-text-back/eligibility.ts` + send pipeline.
- Consent: `src/lib/mctb/capture/eligibility.ts`, `src/lib/mctb/consent-prompt/service.ts`.
- Handoff after reply: `src/lib/mctb/handoff/process-inbound-reply.ts`.
- Links in SMS: `src/lib/mctb/template-vars.ts` → `resolveMctbLinkDestinationUrl`.

---

## Executive summary

| Area | Overall | Notes |
|------|---------|--------|
| A. Onboarding wizard | **Partial** | Core paths wired; voicemail step is checklist-only; demo consent on Try It skips TeXML sync. |
| B. Setup overview | **Complete** (read) / **Partial** (actions) | Aggregates real APIs; pause control wired; KPIs depend on downstream pages. |
| C. Phone & forwarding | **Complete** | Save + verification + carrier guides; “I already set this up” is UX-only (no fake verify). |
| D. Missed-call rules | **Complete** | Same `triggerRules` as Recovery; duplicate editor. |
| E. Text Back | **Complete** | Message + delay → `missedCallTextConfig`; preview matches renderer. |
| F. Links & request form | **Partial** | URL/form/lead capture wired; form field list not editable in UI. |
| G. Consent | **Complete** | Mode + attestation → workspace + `syncMctbConsentRouting`; Press-1 preview from API. |
| H. Notifications & handoff | **Partial** | Config/recipients/test API wired; live SMS/email needs provider; booking-in-thread hook incomplete. |
| I. Recovery controls | **Partial** | Triggers/cooldown/pause/delay wired; max attempts + follow-up row display-only; booking/AI blocks separate. |
| J. Voicemail setup | **Complete** | Greeting → `/api/phone/voicemail`; inbox separate. |
| K. Exclusions | **Complete** | CRUD → suppression in eligibility (`BLOCKED_NUMBER`). |
| L. Test & diagnostics | **Partial** | Real checkpoints from DB/events; full pass requires real calls/SMS. |

---

## A. Onboarding wizard (`/onboarding/mctb`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Business name / phone / carrier / website | `POST /api/mctb/onboarding` → `saveMctbOnboardingState`, workspace name | Business line used in forwarding verification + ingress metadata | **Complete** |
| Progress rail (6 steps) | `GET /api/mctb/onboarding` `state.currentStep` | Resume via `normalizeOnboardingStep` | **Complete** |
| Save & exit | Navigates to `/mctb/setup` (no auto-save of dirty fields) | — | **Partial** |
| Connect calls — `MctbPhoneForwardingPanel` | Onboarding POST + `start_forwarding_test` | `getForwardingVerificationStatus` / voice ingress | **Complete** |
| Trial number auto-provision | `action: provision_trial_number` | MCTB DID + SMS sender | **Complete** |
| Consent mode cards | Onboarding POST `consentMode` + `syncMctbConsentRouting` | TeXML mode + eligibility | **Complete** |
| Recovery — message composer | Onboarding POST `messageTemplate` → `updateMissedCallTextConfig` | Recovery SMS body | **Complete** |
| Recovery — TFV / number drawer | `/api/mctb/tfv`, number drawer → numbers APIs | A2P gating on send | **Complete** |
| Voicemail — “Use default greeting” | `action: mark_voicemail_configured` only (timestamp + step) | Does **not** create greeting; runtime uses default until Setup Voicemail | **Partial** |
| Review checklist + Edit jumps | Onboarding POST `step` | — | **Complete** |
| Run live test | `POST /api/mctb/live-test` | Same engine as Setup → Test | **Complete** |
| Finish / activate trial | `activate_trial`, `step: ready` | Trial gates in `evaluateTrialActivationGates` | **Partial** (live gates) |
| Demo modal — Start demo | `start_demo` → `startMctbTryItSession` (onboarding context) | Demo ingress + SMS | **Complete** |
| Ready screen messaging pending | `GET` tfv + trialNumber | SMS blocked until messaging ready | **Complete** |

**Scripts:** `scripts/test-mctb-onboarding-wizard-flow.ts` (step normalization).

---

## B. Setup overview (`/mctb/setup`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Status rail (recovery, line, sender, forwarding, last test) | `GET /api/mctb/setup`, `/api/mctb/onboarding`, overview | Reflects `enabled`, pause, compliance, verification | **Complete** |
| Pause control | `POST /api/mctb/setup` `enabled` / `pauseUntil` | `MCTB_DISABLED` in eligibility when paused | **Complete** |
| Needs attention / core systems | Derived in `setup-overview-model.ts` | Links to fixing pages | **Complete** |
| Flow strip (missed → forward → consent → text → VM) | Derived from same loads | Illustrative of real flags | **Complete** |
| Summary rows (8 sections) | Per-area GETs listed in architecture audit | Deep links | **Complete** |
| Recent system activity | Onboarding `funnelEvents` | Audit trail only | **Complete** |
| Quick actions | Route links only | — | **Complete** |
| Run live test (header) | Link to `/mctb/setup/test` | — | **Complete** |

---

## C. Phone & forwarding (`/mctb/setup/phone`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Business line input | `POST /api/mctb/setup` `businessLineE164` → `customFieldsConfig.mctb` | Forwarding verification ANI match | **Complete** |
| Forwarding destination / number switch | `POST /api/mctb/setup` `phoneNumberId` | Ingress DID + SMS sender | **Complete** |
| Manage / verify drawer | `/api/mctb/numbers`, TFV routes | Provisioning + messaging readiness | **Complete** |
| Carrier grid | `POST /api/mctb/onboarding` `forwardingCarrier` | Carrier guide copy only | **Complete** |
| View instructions / dial codes | `MCTB_CARRIER_GUIDES` (client) | Customer carrier action (external) | **Partial** (carrier-side) |
| Ring timing presets / custom | Onboarding POST `forwardingRingSeconds` | Timing guidance + verification copy | **Complete** (config); **Partial** (carrier must match) |
| I already set this up | Scroll to verify only | Does not set `verified` | **Complete** (intentional — no fake verify) |
| Run forwarding test | `POST /api/mctb/onboarding` `start_forwarding_test` | `forwardingConnectedAt` when forward detected | **Complete** |
| Connection summary rail | GET setup + onboarding | Read-only | **Complete** |
| Save changes | Setup + onboarding POSTs | — | **Complete** |

**Gate note:** `start_forwarding_test` returns 400 if consent not chosen and workspace not in production activation phase (`isProductionActivationPhase`). After wizard `ready`, phase is true — Setup phone test works.

**Scripts:** `scripts/test-mctb-setup-phone-forwarding.ts`, `scripts/test-mctb-carrier-forwarding.ts`.

---

## D. Missed-call rules (`/mctb/setup/missed-call-rules`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Five trigger toggles | `POST /api/mctb/setup` `triggerRules` → `missedCallTextConfig` | `classificationTriggersMctb` / `TRIGGER_DISABLED` | **Complete** |
| Paused banner | GET schedule | Same pause semantics | **Complete** |
| Link to Recovery for cooldown | Navigation only | Cooldown edited on Recovery | **Partial** (duplicate IA) |
| Save | Same as Recovery triggers | — | **Complete** |

**Duplicate surface:** Same fields as Recovery § “What counts as a missed call?” — both save; last write wins.

---

## E. Text Back (`/mctb/setup/text-back`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Consent method readout | GET setup `consentMode` | TeXML + eligibility | **Complete** |
| Change consent link | Route to Consent | — | **Complete** |
| Recovery opener textarea | `POST /api/mctb/setup` `messageTemplate` → `initial_message` | SMS body after consent | **Complete** |
| Customer preview (2 bubbles Press-1) | Client `MctbSmsPreviewPanel` | Matches locked compliance + opener order | **Complete** |
| Variables `{{customer.*}}`, `{{business.*}}`, `{{link}}` | `resolveMctbTemplateVars` at send | **Complete** |
| Delay seconds | `delaySeconds` on config | Honored in dispatch path | **Complete** |
| Paused banner | GET schedule | Suppresses send when paused | **Complete** |
| Save | `POST /api/mctb/setup` | — | **Complete** |

**Not on this page:** `followUpEnabled` / drip (solution graph) — no editor here.

---

## F. Links & request form (`/mctb/setup/links`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Default link URL | `defaultLinkUrl` on config | `{{link}}` when form off | **Complete** |
| Enable request form | `requestFormEnabled`; auto `requestFormToken` | Public `/f/mctb/:token` | **Complete** |
| Lead capture checkbox | `leadCaptureEnabled` | `src/lib/mctb/request-form.ts` on submit | **Complete** |
| Form fields list | `requestFormFieldsJson` saved; UI shows **defaults only** | Submit uses stored JSON | **Partial** (no field editor) |
| Copy / preview form | Token from GET runtime | Public route | **Complete** |
| Resolved link preview | Client `resolveMctbLinkDestinationUrl` logic | Same as SMS | **Complete** |
| Save | `POST /api/mctb/setup` | — | **Complete** |

**Separate from Recovery → Booking links:** External scheduler URLs in `MctbSetupBookingSection` set `defaultLinkUrl` when “include in recovery” — also feeds `{{link}}` (**Complete** but two UIs for same variable).

**Scripts:** `scripts/test-mctb-setup-links.ts`.

---

## G. Consent (`/mctb/setup/consent`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Press 1 vs existing consent cards | `POST /api/mctb/setup` `consentMode` + attestation | `resolveMctbTexmlHandlerMode`, capture eligibility | **Complete** |
| Existing consent eligibility gate | GET `consentMeta.existingConsentEligible` | Server 400 if not messaging-ready | **Complete** |
| Switch modals + attestation | POST with `existingConsentAttested` | `recordWorkspaceExistingConsentAttestation` | **Complete** |
| Caller experience flow | Display from `setup-consent-model` | Informational | **Complete** |
| Voice disclosure + play | `GET /api/mctb/consent-prompt` | Production Press-1 audio/script | **Complete** |
| If caller does not press 1 | Copy + voicemail path | TeXML gather failure → VM | **Complete** |
| Consent evidence / consent log link | Read-only + `/mctb/compliance/consent` | Consent log API | **Complete** |
| Right rail (sender, recovery, text back) | GET setup | Read-only | **Complete** |
| Save | POST setup + `syncMctbConsentRouting` | TeXML handler update | **Complete** |

**Scripts:** `scripts/test-mctb-setup-consent.ts`, `scripts/test-mctb-consent-modes.ts`, `scripts/test-mctb-consent-texml-route.ts`.

---

## H. Notifications & handoff (`/mctb/setup/notifications`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Response mode (4 choices) | `MctbHandoffConfig.responseMode` via `POST /api/mctb/handoff` | `processMctbInboundReply` branches | **Complete** |
| Appointment booking in thread | `bookingBehavior` stored | Booking hook from thread — **not fully wired** (see handoff audit) | **Partial** |
| Guided collection field requirements | `fieldSchema` on config | `guided-collection.ts` on reply | **Complete** |
| Emergency detection + criteria + actions | Config fields | `urgency.ts` + notifications | **Complete** (logic); **Partial** (live SMS) |
| Team recipients (CRUD fields) | `MctbNotificationRecipient` rows | `notifications.ts` delivery | **Complete** |
| Notification events matrix (email/SMS/in-app) | `routingMatrix` | Per-event channel flags | **Complete** |
| Per-recipient event toggles | `eventChannels` on recipient model | Used when sending | **Partial** (UI does not expose per-recipient channel matrix — workspace-wide table only) |
| Quiet hours + bypass + delay SMS | `quietHours` on config | Notification timing only (not recovery SMS) | **Complete** |
| Send test notification | `POST` `action: test_notification` | Safe preview send | **Partial** (needs provider) |
| Preview tabs (lead / urgent / email) | Static `TEST_PREVIEW` copy | Illustrative | **Partial** |
| Save | `POST /api/mctb/handoff` | — | **Complete** |

**Scripts:** `scripts/test-mctb-setup-notifications.ts`, `scripts/test-mctb-handoff.ts`.

**Doc:** `docs/MCTB-HANDOFF-NOTIFICATIONS-AUDIT.md` (pending live verification list).

---

## I. Recovery controls (`/mctb/setup/recovery`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Recovery status / pause / resume | `POST /api/mctb/setup` pause mutations | `enabled` + `MCTB_DISABLED` | **Complete** |
| Pause modal presets | `pauseUntil`, `enabled: false` | Schedule helpers | **Complete** |
| Missed-call outcome toggles | `triggerRules` (duplicate of §D) | Eligibility triggers | **Complete** |
| Cooldown presets / custom | `cooldownMinutes` | `COOLDOWN_ACTIVE` | **Complete** |
| Recovery delay (modal) | `delaySeconds` in save | Dispatch delay | **Complete** (also on Text Back) |
| AI Lead Recovery link | Nav to `/mctb/...` lead recovery setup | Separate `lead-recovery` config APIs | **Partial** (product surface; live cert manual) |
| Booking — links list / add / edit | `/api/mctb/booking-links` | Conversation/booking tools | **Complete** |
| Include booking link in recovery | Updates `defaultLinkUrl` via setup | `{{link}}` resolution | **Complete** |
| AI Booking block | `/api/mctb/ai-booking/config` | In-thread booking when entitled | **Partial** (entitlement + provider) |
| Follow-up behavior row → Text Back | **Display only** `solution.config.followUpEnabled` | John graph follow-up nodes (`graph.ts`) | **Not connected** (no setup toggle; misleading link) |
| Maximum attempts row | **Display only** `maxMessagesPerCaller` | Enforced in eligibility | **Partial** (runtime yes, UI cannot edit — always default unless changed elsewhere) |
| Why recovery may not send + counts | `GET /api/mctb/missed-calls?status=suppressed` | Diagnostic labels match eligibility codes | **Complete** (read) |
| Right rail / suppressions list | Same API | Read-only | **Complete** |
| Save (triggers, cooldown, delay) | `POST /api/mctb/setup` | — | **Complete** |

**Scripts:** `scripts/test-mctb-setup-recovery.ts` (model/helpers); `scripts/test-mctb-schedule-pause.ts` for pause.

**Doc:** `docs/MCTB-RECOVERY-EXISTING-SYSTEM-AUDIT.md`.

---

## J. Voicemail setup (`/mctb/setup/voicemail`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Greeting source cards (TTS / record / upload) | Presentation; build via `PersonalGreetingControls` | — | **Complete** |
| Create / save greeting | `POST /api/phone/voicemail` `update_box` | TeXML / VM path uses `greetingUrl` / TTS | **Complete** |
| Open voicemail inbox link | `/mctb/voicemail` | Operational inbox | **Complete** |
| ElevenLabs AI voice (product spec) | **Not on this screen** | — | N/A |

**Scripts:** `scripts/test-mctb-voicemail-lifecycle.ts`, `scripts/test-mctb-voicemail-workspace.ts`.

---

## K. Exclusions (`/mctb/setup/exclusions`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| List / search / filters | `GET /api/mctb/exclusions` | — | **Complete** |
| Add / edit / remove | `POST`/`PATCH`/`DELETE` exclusions API | `BLOCKED_NUMBER` in eligibility | **Complete** |
| Summary strip counts | Client model | — | **Complete** |
| Personal vs MCTB types | Source metadata | Suppression store | **Complete** |

**Scripts:** `scripts/test-mctb-setup-exclusions.ts`.

---

## L. Test & diagnostics (`/mctb/setup/test`)

| UI element | API / persistence | Runtime | Rating |
|------------|-------------------|---------|--------|
| Demo — consent cards | `POST /api/mctb/try-it` passes mode; **updates workspace `consentMode` without `syncMctbConsentRouting` in try_it context** | Demo call path | **Partial** (mode stored; TeXML sync skipped for try_it) |
| Demo — start + timeline | `GET/POST /api/mctb/try-it` | `getTryItStatus` checkpoints from real events | **Partial** (needs verified user phone + call) |
| Setup test — start + checkpoints | `POST/GET /api/mctb/setup-test` | Observes voice + SMS pipeline events | **Partial** (live call to assigned DID) |
| Live forward test | `POST/GET /api/mctb/live-test` | Forwarding + recovery chain | **Partial** (live call from business line) |
| Reply received checkpoint | Live test status | Requires inbound SMS to inbox | **Partial** |
| After testing links | Navigation | — | **Complete** |

**Scripts:** `scripts/test-mctb-try-it-ux.ts`, `scripts/test-mctb-final-pipeline-contract.ts`, `npm run verify:mctb-final-pipeline` (pipeline contract).

---

## Cross-cutting gaps (fix candidates)

1. **Duplicate trigger editors** (Missed-call rules + Recovery) — both **Complete** but easy to confuse; not a wiring bug.
2. **Recovery guardrails — Maximum attempts** — shown, not editable in Setup (**Partial**).
3. **Recovery guardrails — Follow-up behavior** — links to Text Back but no follow-up toggle exists (**Not connected** for editing).
4. **Try It consent mode** — writes `consentMode` without TeXML sync in `try_it` context (**Partial** for Press-1 routing during demo-only test).
5. **Onboarding voicemail step** — marks step complete without persisting greeting (**Partial**).
6. **Links — form fields** — JSON saved but UI cannot customize fields (**Partial**).
7. **Notifications — bookingBehavior** — stored; appointment attribution from MCTB thread incomplete (**Partial**).
8. **Notifications — recipient-level eventChannels** — model supports; Setup UI only sets workspace event matrix (**Partial**).
9. **Two link systems** — Links & request form vs Recovery → Booking links both affect `{{link}}` (**Complete** but split UX).

---

## Automated checks (run in repo)

```bash
npx tsx scripts/test-mctb-setup-consent.ts
npx tsx scripts/test-mctb-setup-phone-forwarding.ts
npx tsx scripts/test-mctb-setup-links.ts
npx tsx scripts/test-mctb-setup-notifications.ts
npx tsx scripts/test-mctb-setup-exclusions.ts
npx tsx scripts/test-mctb-setup-recovery.ts
npx tsx scripts/test-mctb-handoff.ts
npx tsx scripts/test-mctb-onboarding-wizard-flow.ts
npm run verify:mctb-final-pipeline   # TeXML press_1 / existing_consent contract
```

**Live certification (not replaceable by scripts):** forwarding verification, setup test, live test, Try It demo, TFV/A2P send, handoff SMS/email delivery — use `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md` and Setup → Test flows on a real phone.

---

## Related existing audits

| Doc | Topic |
|-----|--------|
| `docs/MCTB-SETUP-ARCHITECTURE-AUDIT.md` | APIs per overview |
| `docs/MCTB-PHONE-FORWARDING-EXISTING-SYSTEM-AUDIT.md` | Phone page |
| `docs/MCTB-CONSENT-EXISTING-SYSTEM-AUDIT.md` | Consent runtime |
| `docs/MCTB-RECOVERY-EXISTING-SYSTEM-AUDIT.md` | Eligibility + pause |
| `docs/MCTB-HANDOFF-NOTIFICATIONS-AUDIT.md` | Handoff implementation |
| `docs/MCTB-ONBOARDING-EXISTING-SYSTEM-AUDIT.md` | Wizard state machine |
