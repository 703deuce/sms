# Voice agent — original 8-step wizard → new IA parity audit

**Purpose:** Use the **original eight-screen Appointment Receptionist / voice agent wizard** as the source of truth for everything customers could configure. Compare each screen and field to the **current product IA** (3-stage Receptionist editor + Business Knowledge + Call Handling + Integrations + Numbers), and trace whether values still **persist** and **compile into Voice V3 / LiveKit + GPT-Live (Amy)**.

**This is not** a claim that the 3-stage UI is complete. It is an inventory for onboarding design and gap closure.

---

## Canonical references (repo)

| What | Where |
|------|--------|
| Eight steps (order + labels) | `src/lib/solutions/appointment-receptionist/types.ts` → `WIZARD_STEPS` |
| Step-owned state keys (save merge) | `src/lib/solutions/appointment-receptionist/merge-wizard-state-on-save.ts` → `STEP_OWNED_FIELDS` |
| Step UI implementations | `src/components/solutions/appointment-receptionist/steps/*.tsx` |
| Wizard shell (8 pages) | `src/components/solutions/appointment-receptionist/wizard.tsx` |
| Legacy wizard routes | `/solutions/ai-call-handling/appointment-assistant/setup`, `/dev/appointment-wizard` |
| New 3-stage editor | `/voice/receptionist/edit` → `src/newui-transplant/connected/voice/receptionist-editor/` |
| Business Knowledge | `/voice/knowledge` → `src/components/voice/knowledge/business-knowledge-editor.tsx` |
| Call Handling (Opus) | `/voice/call-handling` → `src/newui-transplant/connected/voice/call-handling-page.tsx` |
| Customer-editable leaves (209) | `src/lib/voice-v3/config/wizard-control-inventory.ts` |
| Per-leaf compiler manifest | `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` / `wizard-v3-field-manifest` |
| Automated compiler/runtime cert | `scripts/test-voice-v3-wizard-backend-propagation.ts` (mutates each leaf on wizard state) |
| Draft → agent config | `buildWizardAgentConfig()` → `advanced.appointmentReceptionistWizard` |
| Voice V3 compile | `compileVoiceV3AgentConfig()` + `from-published-agent.ts` at call time |
| Advanced merge (intake, booking, transfer, KB, after-hours) | `mergeAppointmentWizardAdvanced()` in `wizard-advanced-bridge.ts` |

---

## Runtime pipeline (wizard state → Amy)

1. **Persist:** `POST /api/solutions/appointment-receptionist` with `wizardStepId` merges into stored `AppointmentReceptionistWizardState` on the voice agent (`advanced.appointmentReceptionistWizard`).
2. **Build draft config:** `buildWizardAgentConfig(state)` — telephony, tools, prompts, connection greeting, SMS tools, etc.
3. **Merge advanced:** `mergeAppointmentWizardAdvanced(state)` — `voiceV2Intake`, `bookingStrategy`, `voiceV2Calendly`, `qualification`, `knowledge`, `voiceV2AfterHoursHandling`, `voiceV2OperatingMaturity`, `voiceV2AiCallRecovery`, `receptionistAdvanced.*` policies.
4. **Recompile snapshot (parallel path):** `recompileReceptionistFromDraft()` / `build-receptionist-compiled-prompt.ts` for Layer B instructions.
5. **Voice V3 at runtime:** `compileVoiceV3AgentConfig({ wizard, providerConnections })` → `buildVoiceV3Prompts()` + tool catalog + call context publish (`voice-v3-livekit.ts`).

**Automated cert (2026-03-27):** `VOICE_V3_WIZARD_BACKEND_PROPAGATION: PASS` — **209/209** customer-editable leaves propagate through compiler + `buildWizardAgentConfig` persistence when present on wizard state.  
**That cert does not prove** each leaf has a **non-legacy UI** in the new IA.

---

## New IA surfaces (comparison targets)

| Surface | Route | Saves `wizardStepId` |
|---------|--------|----------------------|
| Receptionist editor (3 stages) | `/voice/receptionist/edit` | `goals`, `information`, `voice`, `appointments`, `call-handling` (grouped) |
| Business Knowledge | `/voice/knowledge` | `information` |
| Call Handling | `/voice/call-handling` | `call-handling` |
| Integrations | `/integrations` (+ native provider pages) | Calendar OAuth / connections (feeds compile `providerConnections`) |
| Numbers / ingress | `/voice/numbers`, Call Handling ingress panel | Partial overlap with **Phone** step |
| **Legacy 8-step wizard** | see routes above | All eight steps |

**Legend — New IA coverage**

| Code | Meaning |
|------|---------|
| **FULL** | Equivalent controls on a permanent new surface |
| **PARTIAL** | Some controls or link-out only; rest legacy/defaults |
| **MISSING** | No permanent new UI; value only via legacy wizard, API, or defaults |
| **MOVED** | Intentionally on another canonical route |
| **N/A** | Control-plane / meta (test, activate) |

**Legend — Runtime**

| Code | Meaning |
|------|---------|
| **✓** | In 209-leaf manifest; propagation cert passes when set on state |
| **—** | Meta / not consumed by live call compiler |

---

## Step 1 — Goals (`goals-step.tsx`)

**Wizard title:** Goals  
**Owned state keys:** `capabilities`, `answerWhen`, `solutionName`, `preset`, `outcomeSlug`

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Solution naming | `solutionName` (“What should we call this Amy?” / agent name sync in hire mode) |
| When agent answers | `answerWhen` radio options (per preset) + coupled `ringBehavior` |
| Capabilities | Toggle/grid: `answer_questions`, `book_appointments`, `reschedule`, `cancel`, `take_messages`, `qualify_callers`, `transfer_calls`, `send_sms_confirmations` |
| Optional permissions | Reschedule / cancel emphasis copy (legacy full wizard) |
| Hire / Amy mode | Locks `book_appointments` + `answer_questions`; sets default `agentName`, `role`, `solutionName` |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Capabilities (all 8) | Receptionist → Stage 2 Responsibilities | **FULL** (`GoalsStep` opus, compact grid) | ✓ |
| `solutionName`, `preset`, `outcomeSlug` | Hidden / preset at create | **MISSING** on 3-stage (loaded from draft) | ✓ |
| **`answerWhen` + ring coupling** | Should be Phone / Call Handling / ingress | **MISSING** on 3-stage (`hideAnswerWhen: true` on Stage 2) | ✓ (`telephony.answerWhen`) |

---

## Step 2 — Phone (`phone-step.tsx`)

**Wizard title:** Phone  
**Owned state keys:** `numberSource`, `phoneNumberId`, `phoneNumberE164`, `outboundSmsMode`, `outboundSmsPhoneNumberId`, `outboundSmsE164`, `ringBehavior`, `ringTeamSeconds`, `callRecording`, `connectionGreeting`, `connectionGreetingText`, `connectionGreetingAudioUrl`

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Readiness strip | Phone number, inbound calling, AI voice, call recording |
| Number source | `existing` \| `buy_new` \| `forward_existing` \| `connect_existing` cards |
| Number picker | Workspace numbers list → `phoneNumberId`, `phoneNumberE164` |
| Answering behavior | `ringBehavior` → also sets `answerWhen` (`every_call`, `nobody_answers`, `after_hours`, `custom_schedule`, `line_busy`) |
| Settings | `ringTeamSeconds`, `callRecording` (`off` \| `all` \| `inbound_only`) |
| Connection greeting | `connectionGreeting` mode + `connectionGreetingText` + `connectionGreetingAudioUrl` (upload) |
| MCTB reuse | Auto-bind MCTB ingress line (MCTB presentation only) |

**Note:** Outbound SMS for booking links is configured on **Appointments** step (`outboundSmsPhoneNumberId`), not Phone step UI.

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Assign voice DID | Numbers + legacy Phone | **PARTIAL** (Numbers; ingress panel on Call Handling) | ✓ |
| `numberSource` | Phone step | **MISSING** | ✓ |
| `ringBehavior` / `answerWhen` (phone-side) | Phone + Goals | **MISSING** on new surfaces | ✓ |
| `ringTeamSeconds` | Phone | **MISSING** | ✓ |
| `callRecording` | Phone / Call Handling | **PARTIAL** (Call Handling switch → `callRecording`) | ✓ |
| Connection greeting (pre-AI mask) | Phone | **MISSING** | ✓ (`startupGreeting` in `buildWizardAgentConfig`) |
| Outbound SMS sender | Appointments (send link) | **MISSING** on 3-stage booking | ✓ |

---

## Step 3 — Information (`information-step.tsx`)

**Wizard title:** Information  
**Owned state keys (save merge):** `knowledgeSource`, `websiteUrl`, `linkedKnowledgeBaseId`, `knowledgeBaseEnabled`, `knowledgeBaseRevision`, `knowledgeItems`, `businessName`, `agentName`, `role`, `tone`, `speakingStyle`, `language`, `speaksFirst`, `openingGreeting`, `conversationBehaviors`, `guardrails`, `timezone`, `longTermMemory`, `crmEnabled`

**Important:** On the **8-screen wizard**, this page is **business knowledge only** (website, KB, schedule). Identity/greeting/conversation UI lives on **Step 6 Voice** but those fields are still owned by `information` for **merge-on-save** when saving other steps.

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Document RAG toggle | `knowledgeBaseEnabled` |
| Knowledge source mode | `website` \| `guided_profile` \| `upload_docs` \| `connect_data` |
| Website import | `websiteUrl`, crawl → `knowledgeItems` |
| Guided profile fields | Patches `knowledgeItems` slices: business, address, hours, services, pricing, policies, FAQs |
| Upload / connect KB | `linkedKnowledgeBaseId`, file upload flows |
| Knowledge item list | Per-item label, summary, status, approve/reject/edit |
| Business schedule | `BusinessScheduleEditor` → `operatingMaturity.businessSchedule`, `timezone` |
| Side panel | Knowledge quality checklist |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| KB RAG toggle | Business Knowledge | **FULL** | ✓ |
| Website crawl / import | Business Knowledge | **FULL** | ✓ |
| Guided facts (`knowledgeItems`) | Business Knowledge | **FULL** | ✓ |
| Weekly hours + holidays | Business Knowledge | **FULL** (`BusinessScheduleEditor`) | ✓ |
| `businessName` | Business Knowledge (+ Receptionist Identity) | **FULL** (both routes write same field) | ✓ |
| `timezone` | Business Knowledge / schedule | **FULL** (via schedule editor) | ✓ |
| `agentName`, role, tone, language, greeting, conversation rules | **Voice step UI** → Receptionist Stage 1 | **FULL** on 3-stage (not on Knowledge page) | ✓ |
| `guardrails[]` (freeform array) | Information (state) | **MISSING** (only fixed `conversationBehaviors` booleans in UI) | ✓ if in state |
| `longTermMemory` | Information | **MISSING** | ✓ |
| `crmEnabled` | Information | **MISSING** | ✓ |

---

## Step 4 — Appointments (`appointments-step.tsx`)

**Wizard title:** Appointments  
**Owned state keys:** Calendar + booking + intake + qualification (see `STEP_OWNED_FIELDS.appointments` in merge file)

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Calendar providers | Connect cards: Microsoft, Google, Calendly, Acuity, Cal.com, etc. → `calendarProvider`, `calendarConnected`, `calendarEmail` |
| Booking strategy | `bookingStrategy`: `MICROSOFT_365`, `REQUEST_ONLY`, `SEND_LINK`, `NONE` + capability coupling |
| Send link block | `bookingLinkUrl`, `bookingLinkLabel`, `bookingLinkSmsConsentRequired`, `outboundSmsPhoneNumberId`, `outboundSmsE164`, `outboundSmsMode` |
| Appointment types | List CRUD: name, duration, calendar, status, location, modality, description, booking hours, min/max notice, `requiredFields`, `bookingPermission`, enabled; `selectedAppointmentTypeId` |
| Per-type configuration | Edit selected type fields |
| Qualification | `qualificationEnabled`, `qualificationRequiredBeforePrimaryAction`, `qualificationSupportedZipCodes`, `qualificationRules[]` (full rule builder), match mode, fallbacks |
| Collect fields | `collectFields[]` (enable, label, required, order, add custom, qualification column) |
| Booking permissions | Per appointment type: `bookingPermission` enum |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Calendar connect | Integrations | **MOVED** (link + provider cards on legacy step; Integrations authoritative) | ✓ |
| Booking strategy tiles | Receptionist Stage 2 | **FULL** (`ReceptionistBookingOpus`) | ✓ |
| Booking behavior (4 toggles) | Receptionist + legacy Call Handling | **PARTIAL** on 3-stage (4 of 6 — see below) | ✓ |
| `askServiceFirst`, `distinguishNewExisting` | Appointments / Call Handling | **MISSING** on 3-stage | ✓ |
| Send link URL / SMS sender / consent | Appointments | **MISSING** on 3-stage | ✓ |
| Calendly event type fields | Appointments / integrations | **MISSING** on 3-stage UI (state keys exist) | ✓ |
| Appointment types CRUD | Appointments | **MISSING** on 3-stage (uses loaded defaults) | ✓ |
| Collect fields | Receptionist Stage 2 | **FULL** (`ReceptionistCollectFieldsOpus`) | ✓ |
| Qualification toggle | Receptionist Stage 2 | **PARTIAL** | ✓ |
| Qualification rules + ZIP lists | Appointments | **MISSING** on 3-stage | ✓ |

---

## Step 5 — Call Handling (`call-handling-step.tsx`)

**Wizard title:** Call Handling  
**Owned state keys:** Transfers, callbacks, notifications, AI recovery, maturity editors, spam (see merge `call-handling` list)

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Flow diagram | Booking vs message flow (visual) |
| Booking behavior (duplicate) | Same 4 `bookingBehavior` checkboxes when booking cap on |
| Emergency & human transfer | `EmergencyTransferEditor`: destinations, waterfall, `transferTriggers`, warm transfer, human transfer flags, caller-requested transfer |
| Urgency (MCTB presentation) | `urgencyEnabled`, `UrgencyRulesEditor` |
| Sales solicitation (MCTB) | `salesSolicitationEnabled` |
| Messages & callbacks | `callbackRequestsEnabled`, `CallbackRequiredFieldsEditor` |
| After-hours notifications | `AfterHoursNotificationsEditor` |
| AI Call Recovery | `aiCallRecoveryEnabled`, consent mode, continue over SMS, delay, sending number |
| Operating maturity | `AfterHoursBehaviorEditor`, `OnCallScheduleEditor`, `CallbackSlaEditor` |

**Related (not only on this step file):** `SpamUnwantedCallsEditor` → `spamLikelyPolicy`, `solicitorPolicy` used on `call-handling-operational-page.tsx` (legacy operational page).

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Callback enable + required fields | Receptionist Stage 2 | **FULL** (`CallbackRequiredFieldsOpus`) | ✓ |
| Callback ANI / preferred time / confirm | Call Handling (state) | **MISSING** on Opus Call Handling transplant | ✓ |
| Emergency transfer editor | Call Handling | **PARTIAL** (add destination + summary; full editor on legacy step) | ✓ |
| After-hours notifications | Call Handling | **PARTIAL** (link “Manage” from Receptionist; editor on legacy step) | ✓ |
| After-hours behavior / on-call / callback SLA | Business Knowledge + Call Handling | **PARTIAL** (schedule on Knowledge; behavior editors legacy) | ✓ |
| AI Call Recovery | Call Handling / product add-on | **MISSING** on Opus Call Handling page | ✓ |
| Urgency rules | Call Handling | **MISSING** on Opus (MCTB-heavy on legacy step) | ✓ |
| Spam / solicitor policies | Call Handling | **PARTIAL** (switches on Opus page; full editor on `call-handling-operational-page`) | ✓ |
| `callRecording` | Phone / Call Handling | **PARTIAL** | ✓ |

---

## Step 6 — Voice (`voice-step.tsx`)

**Wizard title:** Voice  
**Owned state keys:** `voiceId`, `voiceLabel`, `speakingPace`, `voiceAccent`, `backchannelLevel`, `callerPausePatience`, `interruptionStyle`, `voiceSource`, `openAiCustomVoiceId` (+ UI also edits identity/greeting fields patched into state)

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Identity | `agentName`, `businessName`, `role`, `tone`, `speakingStyle`, `language` |
| Voice catalog | All `WIZARD_VOICES` + backups; preview; `voiceId`, `voiceLabel`, `voiceSource` |
| Custom OpenAI voice | `openAiCustomVoiceId` (feature flag) |
| GPT-Live controls | `speakingPace`, `voiceAccent`, `backchannelLevel`, `callerPausePatience`, `interruptionStyle` |
| Greeting | `speaksFirst` (`ai` \| `caller`), `openingGreeting` (500 char, tokens) |
| Conversation rules | `conversationBehaviors.*` (5 booleans) |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Identity block | Receptionist Stage 1 | **FULL** | ✓ |
| Voice picks + preview | Receptionist Stage 1 | **FULL** | ✓ |
| GPT-Live prompt controls | Receptionist Stage 1 “Conversation style” | **FULL** | ✓ |
| Greeting | Receptionist Stage 1 | **FULL** | ✓ |
| Conversation rules | Receptionist Stage 1 | **FULL** | ✓ |
| Custom OpenAI voice | Voice step (flagged) | **MISSING** unless flag on (same as legacy) | ✓ |

---

## Step 7 — Test (`test-step.tsx`)

**Wizard title:** Test  
**Owned state keys:** `testScenario`, `lastTestPassed`

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Browser vs phone modes | Live test UI |
| Save draft for test | `onEnsureAgent` → `agentId` |
| `VoiceV3BrowserCall` | WebRTC draft test |
| PSTN guidance | `phoneNumberE164` display |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Test UX | Receptionist Stage 3 | **FULL** (`TestStep` `presentation="opus"`) | — |
| `testScenario` | Test (legacy) | **MISSING** (not exposed in 3-stage) | — |

---

## Step 8 — Activate (`activate-step.tsx`)

**Wizard title:** Activate  
**Owned state keys:** `activationMode`, `scheduledAt`

### UI on original screen

| Section | Controls / fields |
|---------|-------------------|
| Readiness grid | From `buildWizardReadinessRows` + `getWizardActivationIssues` |
| Calendar probe | Sync `calendarConnected` / provider / email |
| Activate CTA | `activationMode: activate_now`, publish |
| Go to test | Navigation |

### New IA vs runtime

| Domain | New owner | New IA | Runtime ✓ |
|--------|-----------|--------|-----------|
| Readiness review | Receptionist Stage 3 | **FULL** (review + readiness pills) | — |
| Publish / go live | Receptionist Stage 3 | **FULL** (`publish` / Go live) | — |
| Scheduled activation | Activate step | **MISSING** (`scheduledAt` not on 3-stage) | — |

---

## Master comparison table (product domains)

| Original wizard domain | Primary 8-step screen(s) | New IA home | Stored on wizard state | Compiles to Voice V3 / Amy | New IA edit coverage |
|------------------------|--------------------------|-------------|------------------------|----------------------------|----------------------|
| Solution name / preset | Goals | — | ✓ | control plane | **MISSING** |
| Capabilities (8) | Goals | Receptionist S2 | ✓ | ✓ | **FULL** |
| Answer when / ring routing | Goals + Phone | Call Handling / Numbers | ✓ | ✓ | **MISSING** |
| Phone number assignment | Phone | Numbers / ingress | ✓ | ✓ | **PARTIAL** |
| Ring team seconds | Phone | — | ✓ | ✓ | **MISSING** |
| Call recording | Phone | Call Handling | ✓ | ✓ | **PARTIAL** |
| Connection greeting (pre-AI) | Phone | — | ✓ | ✓ | **MISSING** |
| KB / website / documents | Information | Business Knowledge | ✓ | ✓ | **FULL** |
| Business hours / holidays | Information | Business Knowledge | ✓ | ✓ | **FULL** |
| Business name | Information + Voice | Knowledge + Receptionist S1 | ✓ | ✓ | **FULL** |
| Agent identity & conversation | Voice (+ information merge) | Receptionist S1 | ✓ | ✓ | **FULL** |
| Voice & GPT-Live controls | Voice | Receptionist S1 | ✓ | ✓ | **FULL** |
| Calendar provider | Appointments | Integrations | ✓ | ✓ | **MOVED** |
| Booking strategy | Appointments | Receptionist S2 | ✓ | ✓ | **FULL** |
| Send-link + outbound SMS | Appointments | — | ✓ | ✓ | **MISSING** |
| Appointment types | Appointments | — | ✓ | ✓ | **MISSING** |
| Collect fields | Appointments | Receptionist S2 | ✓ | ✓ | **FULL** |
| Qualification rules | Appointments | — | ✓ | ✓ | **PARTIAL** / **MISSING** rules |
| Booking behavior (6 flags) | Appointments + Call Handling | Receptionist S2 | ✓ | ✓ | **PARTIAL** (4/6) |
| Transfers / urgency | Call Handling | Call Handling | ✓ | ✓ | **PARTIAL** |
| Callbacks | Call Handling | Receptionist S2 | ✓ | ✓ | **FULL** (required fields); **PARTIAL** (other callback flags) |
| After-hours notifications | Call Handling | Call Handling link | ✓ | ✓ | **PARTIAL** |
| On-call / after-hours behavior / SLA | Call Handling | Knowledge + Call Handling | ✓ | ✓ | **PARTIAL** |
| AI call recovery | Call Handling | — | ✓ | ✓ | **MISSING** |
| Spam / solicitor | Call Handling | Call Handling | ✓ | ✓ | **PARTIAL** |
| Long-term memory / CRM | Information (state) | — | ✓ | ✓ | **MISSING** |
| Custom guardrails array | Information (state) | — | ✓ | partial | **MISSING** |
| Test live | Test | Receptionist S3 | ✓ | — | **FULL** |
| Activate / schedule | Activate | Receptionist S3 | ✓ | — | **PARTIAL** |

---

## Gap list — onboarding must account for these

These are **not** compiler failures (209-leaf cert passes). They are **IA / configurability** gaps relative to the **original eight screens**:

1. **Entire Phone step** (connection greeting, ring team, number source, ring behavior UI) — no single Opus equivalent.
2. **`answerWhen`** — hidden on 3-stage Responsibilities (`hideAnswerWhen`).
3. **Appointment types** — full CRUD only on legacy Appointments step.
4. **Send booking link** block (URL, SMS sender, consent) — legacy Appointments only.
5. **Calendly-specific** wizard fields — no dedicated Opus editor found.
6. **Qualification rules builder** — toggle only on 3-stage.
7. **`bookingBehavior.askServiceFirst` / `distinguishNewExisting`** — not on Opus booking panel.
8. **AI Call Recovery** block — legacy Call Handling step only.
9. **Full emergency transfer / urgency / notification editors** — partial on Opus Call Handling.
10. **`longTermMemory`, `crmEnabled`, `guardrails[]`** — no Opus editor located.
11. **Scheduled activation** — legacy Activate step only.

**Legacy fallback still required today for full parity:**  
`/solutions/ai-call-handling/appointment-assistant/setup` or `/dev/appointment-wizard` (`AppointmentReceptionistWizard`).

---

## Appendix A — `STEP_OWNED_FIELDS` by wizard step

Copied from `merge-wizard-state-on-save.ts` (authoritative for save-merge).

### `goals`
`capabilities`, `answerWhen`, `solutionName`, `preset`, `outcomeSlug`

### `phone`
`numberSource`, `phoneNumberId`, `phoneNumberE164`, `outboundSmsMode`, `outboundSmsPhoneNumberId`, `outboundSmsE164`, `ringBehavior`, `ringTeamSeconds`, `callRecording`, `connectionGreeting`, `connectionGreetingText`, `connectionGreetingAudioUrl`

### `information`
`knowledgeSource`, `websiteUrl`, `linkedKnowledgeBaseId`, `knowledgeBaseEnabled`, `knowledgeBaseRevision`, `knowledgeItems`, `businessName`, `agentName`, `role`, `tone`, `speakingStyle`, `language`, `speaksFirst`, `openingGreeting`, `conversationBehaviors`, `guardrails`, `timezone`, `longTermMemory`, `crmEnabled`

### `appointments`
`calendarProvider`, `calendarConnected`, `calendarEmail`, `appointmentTypes`, `selectedAppointmentTypeId`, `bookingStrategy`, `bookingLinkUrl`, `bookingLinkLabel`, `bookingLinkSmsConsentRequired`, `calendlyEventTypeUri`, `calendlyEventTypeName`, `calendlyEventTypeDurationMin`, `calendlyTimezone`, `bookingBehavior`, `qualificationEnabled`, `qualificationRequiredBeforePrimaryAction`, `qualificationRevision`, `qualificationSupportedZipCodes`, `qualificationRulesMatchMode`, `qualificationNotQualifiedFallback`, `qualificationNeedsReviewFallback`, `qualificationRules`, `collectFields`

### `call-handling`
`transferTriggers`, `transferDestinationName`, `transferDestinationPhone`, `transferRingSeconds`, `transferFallback`, `warmTransfer`, `detectVoicemailOnTransfer`, `voiceV2HumanTransferEnabled`, `allowCallerRequestedTransfer`, `transferRouting`, `defaultTransferPlanId`, `transferDestinations`, `transferPlanSteps`, `urgencyEnabled`, `urgencyRules`, `callbackRequestsEnabled`, `callbackUseAniByDefault`, `callbackAskPreferredTime`, `callbackConfirmNumber`, `callbackRequiredCollectFieldIds`, `afterHoursNotificationEvents`, `afterHoursNotificationRecipients`, `salesSolicitationEnabled`, `salesSolicitationAction`, `spamLikelyPolicy`, `solicitorPolicy`, `operatingMaturity`, `aiCallRecoveryEnabled`, `aiCallRecoveryConsentMode`, `aiCallRecoverySendingPhoneNumberId`, `aiCallRecoveryContinueOverSms`, `aiCallRecoveryDelaySeconds`, `aiCallRecoverySendWhenCallbackCreated`, `capabilities`, `callRecording`

### `voice`
`voiceId`, `voiceLabel`, `speakingPace`, `voiceAccent`, `backchannelLevel`, `callerPausePatience`, `interruptionStyle`, `voiceSource`, `openAiCustomVoiceId`

### `test`
`testScenario`, `lastTestPassed`

### `activate`
`activationMode`, `scheduledAt`

---

## Appendix B — Verify compiler parity locally

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-backend-propagation.ts
```

Expect: `VOICE_V3_WIZARD_BACKEND_PROPAGATION: PASS` and `failures: 0`.

---

## Appendix C — 3-stage Receptionist mapping (quick)

| 3-stage section | Covers original wizard |
|-----------------|-------------------------|
| **S1 Identity & Conversation** | Voice step (identity, voice, greeting, conversation rules) — **not** Information knowledge |
| **S2 Responsibilities & Call Flow** | Goals (caps only), partial Appointments, partial Call Handling (callbacks), links to Knowledge / Call Handling / Integrations |
| **S3 Review & Test** | Test + Activate (readiness, publish) |

---

*Generated for copy/paste and onboarding planning. Re-run the propagation script after schema or manifest changes.*
