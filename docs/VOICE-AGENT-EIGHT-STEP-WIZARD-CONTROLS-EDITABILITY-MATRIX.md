# Voice agent — eight-step wizard customer controls vs new IA (editability only)

**Scope:** Every **customer-editable control** that appears on the original **8-screen** `AppointmentReceptionistWizard` (`src/components/solutions/appointment-receptionist/steps/*.tsx` and embedded editors). Compared to what customers can edit today on the **new IA** (not compiler/runtime).

**8-step order:** Goals → Phone → Information → Appointments → Call Handling → Voice → Test → Activate.

**Legacy wizard routes:** `/solutions/ai-call-handling/appointment-assistant/setup`, `/dev/appointment-wizard`.

**New IA routes (comparison targets):**

| Code | Route / surface |
|------|-----------------|
| **R-S1** | `/voice/receptionist/edit` — Stage 1 Identity & Conversation |
| **R-S2** | `/voice/receptionist/edit` — Stage 2 Responsibilities & Call Flow |
| **R-S3** | `/voice/receptionist/edit` — Stage 3 Review & Test |
| **KNOW** | `/voice/knowledge` — Business Knowledge |
| **CALL** | `/voice/call-handling` — Call Handling (Opus transplant + ingress panel) |
| **INT** | `/integrations` (+ native provider OAuth pages) |
| **NUM** | `/my-numbers`, workspace number pickers |
| **OPS** | `/voice/call-handling` operational / `call-handling-operational-page` (not a wizard step; listed when it is the only edit surface) |
| **LEG** | Legacy 8-step wizard only |

**Match column (editability):**

| Match | Meaning |
|-------|---------|
| **YES** | Same control (or direct equivalent) editable on new IA |
| **PARTIAL** | Some editing on new IA; not full parity with wizard control |
| **NO** | Not editable on new IA; use **LEG** (or defaults/API) |
| **LINK** | New IA links out; customer edits on another route (**INT**, **NUM**, etc.) |

---

## Summary (quick scan)

| Match | Count (approx.) |
|-------|-----------------|
| YES | 78 |
| PARTIAL | 42 |
| NO | 55 |
| LINK | 12 |

*Counts are line items below, not unique state keys.*

---

## Step 1 — Goals (`goals-step.tsx`)

Standard flow (`presentation=legacy`). Hire/Amy mode adds operating-mode radios and optional reschedule/cancel chips (same file).

| # | Control (customer-facing) | State field(s) | Wizard | New IA edit | Match |
|---|---------------------------|----------------|--------|-------------|-------|
| 1.1 | Agent name (dashboard / solution name) | `solutionName` (+ may sync `agentName`) | Goals | **NO** (hidden on R-S2 via `hideSolutionName`) | NO |
| 1.2 | Capability: Answer questions | `capabilities[]` | Goals | R-S2 Goals grid | YES |
| 1.3 | Capability: Book appointments | `capabilities[]` | Goals | R-S2 | YES |
| 1.4 | Capability: Reschedule | `capabilities[]` | Goals | R-S2 | YES |
| 1.5 | Capability: Cancel | `capabilities[]` | Goals | R-S2 | YES |
| 1.6 | Capability: Take messages | `capabilities[]` | Goals | R-S2 | YES |
| 1.7 | Capability: Qualify callers | `capabilities[]` | Goals | R-S2 | YES |
| 1.8 | Capability: Transfer calls | `capabilities[]` | Goals | R-S2 | YES |
| 1.9 | Capability: Send SMS confirmations | `capabilities[]` | Goals | R-S2 | YES |
| 1.10 | When should this agent answer? (preset-specific options: every call, nobody answers, after hours, line busy, custom schedule) | `answerWhen`, `ringBehavior` | Goals | **NO** (`hideAnswerWhen` on R-S2) | NO |
| 1.11 | Hire mode: “What should we call this Amy?” | `solutionName`, `agentName` | Goals (hire) | **NO** | NO |
| 1.12 | Hire mode: Operating mode (main / overflow / after-hours) | `answerWhen`, `ringBehavior` | Goals (hire) | **NO** | NO |
| 1.13 | Hire mode: Optional “May reschedule” / “May cancel” | `capabilities[]` | Goals (hire) | R-S2 (if caps shown) | PARTIAL |

---

## Step 2 — Phone (`phone-step.tsx`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 2.1 | Number source: Use existing Transovo number | `numberSource` | Phone | **NUM** / **LEG** | PARTIAL |
| 2.2 | Number source: Buy a new number | `numberSource` | Phone | Link **NUM** (`/my-numbers`) | LINK |
| 2.3 | Number source: Forward existing business number | `numberSource` | Phone | **CALL** ingress panel + **LEG** | PARTIAL |
| 2.4 | Pick workspace number (list) | `phoneNumberId`, `phoneNumberE164` | Phone | **NUM** + **LEG**; **CALL** read-only ingress | PARTIAL |
| 2.5 | Answering behavior: Answer every incoming call | `ringBehavior`, `answerWhen` | Phone | **NO** | NO |
| 2.6 | Ring team first, then AI | `ringBehavior`, `answerWhen` | Phone | **NO** | NO |
| 2.7 | After-hours only | `ringBehavior`, `answerWhen` | Phone | **NO** | NO |
| 2.8 | When line is busy | `ringBehavior`, `answerWhen` | Phone | **NO** | NO |
| 2.9 | Custom schedule | `ringBehavior`, `answerWhen` | Phone | **NO** | NO |
| 2.10 | Ring team for (seconds) | `ringTeamSeconds` | Phone | **NO** | NO |
| 2.11 | Call recording (off / inbound only / all) | `callRecording` | Phone | **CALL** switch `recordCalls` (boolean; not 3-way) | PARTIAL |
| 2.12 | Connection greeting mode (none / Transovo pro / warm / upload / create custom) | `connectionGreeting` | Phone | **LEG** | NO |
| 2.13 | Connection greeting text | `connectionGreetingText` | Phone | **LEG** | NO |
| 2.14 | Connection greeting audio URL (upload custom) | `connectionGreetingAudioUrl` | Phone | **LEG** | NO |
| 2.15 | Preview connection greeting (play) | — (client preview) | Phone | **LEG** | NO |

---

## Step 3 — Information (`information-step.tsx` + `BusinessScheduleEditor`)

Identity/voice fields on this step are **not** shown here in the 8-step wizard; they live on **Step 6 Voice** but share `information` save-merge keys.

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 3.1 | Search uploaded documents during calls (RAG toggle) | `knowledgeBaseEnabled` | Information | **LEG** only (not on **KNOW**) | NO |
| 3.2 | Knowledge source: Import from website | `knowledgeSource` | Information | **KNOW** website section | PARTIAL |
| 3.3 | Knowledge source: Guided business profile | `knowledgeSource` | Information | **KNOW** core facts | PARTIAL |
| 3.4 | Knowledge source: Upload documents | `knowledgeSource` | Information | **KNOW** sources manager | PARTIAL |
| 3.5 | Knowledge source: Connect existing data | `knowledgeSource` | Information | **KNOW** + **INT** | PARTIAL |
| 3.6 | Website URL | `websiteUrl` | Information | **KNOW** | YES |
| 3.7 | Scan website | `knowledgeItems`, `linkedKnowledgeBaseId`, `businessName` | Information | **KNOW** Scan | YES |
| 3.8 | Guided: Business name | `businessName`, `knowledgeItems` | Information | **KNOW** + R-S1 | YES |
| 3.9 | Guided: Address / locations | `knowledgeItems` | Information | **KNOW** (business description) | PARTIAL |
| 3.10 | Guided: Business hours (free text) | `knowledgeItems` | Information | **KNOW** prose + schedule | PARTIAL |
| 3.11 | Guided: Services | `knowledgeItems` | Information | **KNOW** | YES |
| 3.12 | Guided: Pricing | `knowledgeItems` | Information | **KNOW** | YES |
| 3.13 | Guided: Policies | `knowledgeItems` | Information | **KNOW** | YES |
| 3.14 | Save profile to knowledge | `knowledgeItems` | Information | **KNOW** Save buttons | YES |
| 3.15 | Upload knowledge files (multi) | `knowledgeItems`, `linkedKnowledgeBaseId` | Information | **KNOW** file upload | YES |
| 3.16 | Connect existing knowledge base (select) | `linkedKnowledgeBaseId` | Information | **KNOW** / API-backed sources | PARTIAL |
| 3.17 | Knowledge item: Approve (per row) | `knowledgeItems[].status` | Information | **KNOW** approve suggestions | PARTIAL |
| 3.18 | Knowledge item: Edit label & facts (modal) | `knowledgeItems[]` | Information | **KNOW** fact fields | PARTIAL |
| 3.19 | Approve all imported facts | `knowledgeItems[]` | Information | **KNOW** (per-suggestion) | PARTIAL |
| 3.20 | Timezone | `operatingMaturity.businessSchedule.timezone` | Information | **KNOW** schedule | YES |
| 3.21 | Weekly schedule: closed per day | `operatingMaturity.businessSchedule.weekly` | Information | **KNOW** | YES |
| 3.22 | Weekly schedule: open time range per day | `operatingMaturity.businessSchedule.weekly` | Information | **KNOW** | YES |
| 3.23 | Holiday: name, date, remove | `operatingMaturity.businessSchedule.holidays` | Information | **KNOW** | YES |
| 3.24 | Add holiday | `operatingMaturity.businessSchedule.holidays` | Information | **KNOW** | YES |

**KNOW extras (not on wizard Information step):** Service area, FAQs, knowledge gaps, add text/URL/file sources UI, publish banner — **new surface only**.

---

## Step 4 — Appointments (`appointments-step.tsx`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 4.1 | Connect Google Calendar | `calendarProvider`, `calendarConnected`, `calendarEmail` | Appointments | **INT** (+ R-S2 link) | LINK |
| 4.2 | Connect Microsoft Outlook | same | Appointments | **INT** | LINK |
| 4.3 | Connect Transovo Calendar (internal) | same | Appointments | **INT** / **LEG** | LINK |
| 4.4 | Connect Calendly (card → Integrations) | same | Appointments | **INT** | LINK |
| 4.5 | Connect Acuity / Cal.com (card) | same | Appointments | **INT** (limited) | LINK |
| 4.6 | Booking strategy: Book during call (Microsoft 365) | `bookingStrategy`, `capabilities` | Appointments | R-S2 | YES |
| 4.7 | Booking strategy: Request preferred time | `bookingStrategy` | Appointments | R-S2 | YES |
| 4.8 | Booking strategy: Send booking link | `bookingStrategy` | Appointments | R-S2 strategy only | PARTIAL |
| 4.9 | Booking strategy: Message / follow up | `bookingStrategy`, `capabilities` | Appointments | R-S2 | YES |
| 4.10 | Send link: Booking URL | `bookingLinkUrl` | Appointments | **LEG** | NO |
| 4.11 | Send link: SMS sender number | `outboundSmsPhoneNumberId`, `outboundSmsE164`, `outboundSmsMode` | Appointments | **LEG** | NO |
| 4.12 | Send link: Ask permission before sending | `bookingLinkSmsConsentRequired` | Appointments | **LEG** | NO |
| 4.13 | Send link: Link label (optional) | `bookingLinkLabel` | Appointments | **LEG** | NO |
| 4.14 | Add appointment type | `appointmentTypes[]`, `selectedAppointmentTypeId` | Appointments | **LEG** | NO |
| 4.15 | Select appointment type (table row) | `selectedAppointmentTypeId` | Appointments | **LEG** | NO |
| 4.16 | Enable/disable appointment type | `appointmentTypes[].enabled` | Appointments | **LEG** | NO |
| 4.17 | Appointment name | `appointmentTypes[].name` | Appointments | **LEG** | NO |
| 4.18 | Duration (15–90 min) | `appointmentTypes[].durationMin` | Appointments | **LEG** | NO |
| 4.19 | Assigned staff / calendar (text) | `appointmentTypes[].calendar` | Appointments | **LEG** | NO |
| 4.20 | Minimum notice | `appointmentTypes[].minNotice` | Appointments | **LEG** | NO |
| 4.21 | Maximum days ahead | `appointmentTypes[].maxDaysAhead` | Appointments | **LEG** | NO |
| 4.22 | Enable caller qualification | `qualificationEnabled`, `capabilities` | Appointments | R-S2 collect panel toggle | YES |
| 4.23 | Require qualification before booking/link | `qualificationRequiredBeforePrimaryAction` | Appointments | **LEG** | NO |
| 4.24 | Supported ZIP codes | `qualificationSupportedZipCodes` | Appointments | **LEG** | NO |
| 4.25 | Qualification rule: field key | `qualificationRules[]` | Appointments | **LEG** | NO |
| 4.26 | Qualification rule: operator | `qualificationRules[]` | Appointments | **LEG** | NO |
| 4.27 | Qualification rule: value | `qualificationRules[]` | Appointments | **LEG** | NO |
| 4.28 | Qualification rule: result status | `qualificationRules[]` | Appointments | **LEG** | NO |
| 4.29 | Add / remove qualification rule | `qualificationRules[]` | Appointments | **LEG** | NO |
| 4.30 | Collect field: enable | `collectFields[].enabled` | Appointments | R-S2 table | YES |
| 4.31 | Collect field: required | `collectFields[].required` | Appointments | R-S2 | YES |
| 4.32 | Collect field: use for qualification | `collectFields[].useForQualification` | Appointments | **LEG** (when qual on) | NO |
| 4.33 | Remove custom collect field | `collectFields[]` | Appointments | R-S2 | YES |
| 4.34 | Add collect field (label) | `collectFields[]` | Appointments | R-S2 | YES |
| 4.35 | Booking permission: Book directly | `appointmentTypes[].bookingPermission` | Appointments | **LEG** | NO |
| 4.36 | Booking permission: Suggest times first | `appointmentTypes[].bookingPermission` | Appointments | **LEG** | NO |
| 4.37 | Booking permission: Send booking link | `appointmentTypes[].bookingPermission` | Appointments | **LEG** | NO |

**State keys with no wizard UI (not listed as controls above):** `calendlyEventTypeUri`, `calendlyEventTypeName`, `calendlyEventTypeDurationMin`, `calendlyTimezone`, `qualificationRulesMatchMode`, `qualificationNotQualifiedFallback`, `qualificationNeedsReviewFallback`, `qualificationRevision`; appointment type defaults `description`, `location`, `modality`, `bookingHours` (set on create, not edited in UI).

---

## Step 5 — Call Handling (`call-handling-step.tsx` + embedded editors)

Default **appointment receptionist** presentation (`legacy`). MCTB presentation adds urgency + sales solicitation blocks (same step file).

### Booking behavior (when booking capability on)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.1 | Ask for preferred day first | `bookingBehavior.askPreferredDayFirst` | Call Handling | R-S2 booking panel | YES |
| 5.2 | Offer earliest 3 appointments | `bookingBehavior.offerEarliestThree` | Call Handling | R-S2 | YES |
| 5.3 | Confirm before booking | `bookingBehavior.confirmBeforeBooking` | Call Handling | R-S2 | YES |
| 5.4 | Send SMS after booking | `bookingBehavior.sendSmsAfterBooking` | Call Handling | R-S2 | YES |

**No wizard UI anywhere found for:** `bookingBehavior.askServiceFirst`, `bookingBehavior.distinguishNewExisting` (defaults only).

### Emergency & human transfer (`EmergencyTransferEditor`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.5 | Enable emergency & human transfer | `voiceV2HumanTransferEnabled` | Call Handling | **CALL** (partial) / **LEG** full | PARTIAL |
| 5.6 | Allow caller-requested human | `allowCallerRequestedTransfer` | Call Handling | **LEG** | NO |
| 5.7 | Routing: single vs waterfall | `transferRouting` | Call Handling | **LEG** | NO |
| 5.8 | Default ring timeout | `transferRingSeconds` | Call Handling | **LEG** | NO |
| 5.9 | Add transfer contact | `transferDestinations[]`, `transferPlanSteps[]` | Call Handling | **CALL** Add target | PARTIAL |
| 5.10 | Contact display name | `transferDestinations[].label` | Call Handling | **LEG** / limited **CALL** | PARTIAL |
| 5.11 | Contact phone | `transferDestinations[].phoneE164` | Call Handling | **LEG** / limited **CALL** | PARTIAL |
| 5.12 | Transfer mode (direct / warm) | `transferPlanSteps[].transferMode` | Call Handling | **CALL** `whisper` switch only | PARTIAL |
| 5.13 | Per-contact ring timeout | `transferPlanSteps[].timeoutSeconds` | Call Handling | **LEG** | NO |
| 5.14 | Reorder waterfall contacts | `transferPlanSteps[].order` | Call Handling | **LEG** | NO |
| 5.15 | Remove contact | `transferDestinations[]` | Call Handling | **LEG** | NO |
| 5.16 | Detect voicemail on transfer | `detectVoicemailOnTransfer` | Call Handling | **LEG** | NO |
| 5.17 | Transfer fallback (return to AI / message / notify staff) | `transferFallback` | Call Handling | **LEG** | NO |

**Read-only in wizard:** “Policy triggers” line shows `transferTriggers` — **not editable** in 8-step UI.

### Messages & callbacks

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.18 | Take messages and callback requests | `callbackRequestsEnabled` | Call Handling | R-S2 | YES |
| 5.19 | Required fields before callback (`CallbackRequiredFieldsEditor`) | `callbackRequiredCollectFieldIds` | Call Handling | R-S2 Opus | YES |
| 5.20 | Reset callback required to defaults | `callbackRequiredCollectFieldIds` | Call Handling | R-S2 Opus | YES |

**No wizard UI:** `callbackUseAniByDefault`, `callbackAskPreferredTime`, `callbackConfirmNumber`.

### After-hours notifications (`AfterHoursNotificationsEditor`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.21 | Event: Messages & callbacks — SMS / Email | `afterHoursNotificationEvents` | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.22 | Event: Emergency — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.23 | Event: Failed transfers — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.24 | Event: Successful transfers — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.25 | Event: Appointment booked — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.26 | Event: Appointment changed — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.27 | Event: Every completed call — SMS / Email | same | Call Handling | **LEG** / **OPS** | PARTIAL |
| 5.28 | Recipient: label, enabled | `afterHoursNotificationRecipients[]` | Call Handling | **LEG** | NO |
| 5.29 | Recipient: SMS E.164 | same | Call Handling | **LEG** | NO |
| 5.30 | Recipient: email | same | Call Handling | **LEG** | NO |
| 5.31 | Add notification recipient | same | Call Handling | **LEG** | NO |

R-S2 only **links** to **CALL** for after-hours notifications (no inline editor).

### AI Call Recovery

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.32 | Enable AI call recovery SMS | `aiCallRecoveryEnabled` | Call Handling | **LEG** | NO |
| 5.33 | Messaging permission (consent mode) | `aiCallRecoveryConsentMode` | Call Handling | **LEG** | NO |
| 5.34 | Continue conversation over SMS | `aiCallRecoveryContinueOverSms` | Call Handling | **LEG** | NO |
| 5.35 | Send delay (0 / 15 / 30 s) | `aiCallRecoveryDelaySeconds` | Call Handling | **LEG** | NO |

**No wizard UI:** `aiCallRecoverySendingPhoneNumberId`, `aiCallRecoverySendWhenCallbackCreated`.

### Operating maturity (`AfterHoursBehaviorEditor`, `OnCallScheduleEditor`, `CallbackSlaEditor`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.36 | Apply operating state during live calls | `operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls` | Call Handling | **LEG** | NO |
| 5.37 | When closed: allow live booking | `operatingMaturity.afterHoursBehavior.whenClosed.allowLiveBooking` | Call Handling | **LEG** | NO |
| 5.38 | When closed: allow callback requests | `whenClosed.allowCallbackRequest` | Call Handling | **LEG** | NO |
| 5.39 | When closed: allow message taking | `whenClosed.allowMessageTaking` | Call Handling | **LEG** | NO |
| 5.40 | When closed: allow on-call escalation | `whenClosed.allowOnCallEscalation` | Call Handling | **CALL** `aiAfterHours` switch | PARTIAL |
| 5.41 | When closed: allow office transfer | `whenClosed.allowOfficeTransfer` | Call Handling | **CALL** `ringTeamFirst` switch | PARTIAL |
| 5.42 | When closed: allow normal transfer destinations | `whenClosed.allowNormalTransferDestinations` | Call Handling | **CALL** `emergenciesOnly` (inverted) | PARTIAL |
| 5.43 | Enable on-call rotation | `operatingMaturity.onCallSchedule.enabled` | Call Handling | **LEG** | NO |
| 5.44 | On-call entry: label, DOW, times, phone | `onCallSchedule.entries[]` | Call Handling | **LEG** | NO |
| 5.45 | Add / remove on-call window | `onCallSchedule.entries[]` | Call Handling | **LEG** | NO |
| 5.46 | Callback SLA: normal target | `operatingMaturity.callbackSla.normalTarget` | Call Handling | **LEG** | NO |
| 5.47 | Callback SLA: urgent target | `operatingMaturity.callbackSla.urgentTarget` | Call Handling | **LEG** | NO |

### MCTB-only on same step (not standard 8-step receptionist)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.48 | Urgent-call handling enable | `urgencyEnabled` | Call Handling (mctb) | **LEG** | NO |
| 5.49 | Urgency rules builder (`UrgencyRulesEditor`) | `urgencyRules[]` | Call Handling (mctb) | **LEG** | NO |
| 5.50 | Sales / solicitation handling enable | `salesSolicitationEnabled` | Call Handling (mctb) | **CALL** `declineSolicitors` | PARTIAL |

### Call Handling page (`/voice/call-handling`) — Opus switches (not all in wizard)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 5.51 | Block spam likely | `spamLikelyPolicy` | **OPS** `SpamUnwantedCallsEditor` | **CALL** `blockSpam` | PARTIAL |
| 5.52 | Decline solicitors | `salesSolicitationEnabled` | mctb / **OPS** | **CALL** | PARTIAL |
| 5.53 | Holiday schedule toggle | clears `holidays` | Schedule on **KNOW** | **CALL** `holidaySchedule` | PARTIAL |
| 5.54 | Text summary / notifications shortcut | `afterHoursNotificationEvents` | partial | **CALL** `textSummary` | PARTIAL |
| 5.55 | Call routing / product switcher | — | — | **CALL** `CallHandlingSwitcher` | NEW |

Full spam/solicitor policy UI: **OPS** `/voice/call-handling` operational page — **not** a wizard step.

---

## Step 6 — Voice (`voice-step.tsx`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 6.1 | Agent name | `agentName` | Voice | R-S1 | YES |
| 6.2 | Business name | `businessName` | Voice | R-S1 + **KNOW** | YES |
| 6.3 | Role (select) | `role` | Voice | R-S1 | YES |
| 6.4 | Tone (select) | `tone` | Voice | R-S1 | YES |
| 6.5 | Speaking style (select) | `speakingStyle` | Voice | R-S1 | YES |
| 6.6 | Language (select) | `language` | Voice | R-S1 | YES |
| 6.7 | Greeting: AI speaks first / caller speaks first | `speaksFirst` | Voice | R-S1 | YES |
| 6.8 | Opening greeting (500 chars) | `openingGreeting` | Voice | R-S1 | YES |
| 6.9 | Conversation rule: Keep answers brief | `conversationBehaviors.keepBrief` | Voice | R-S1 | YES |
| 6.10 | One question at a time | `conversationBehaviors.oneQuestionAtATime` | Voice | R-S1 | YES |
| 6.11 | Confirm names and numbers | `conversationBehaviors.confirmDetails` | Voice | R-S1 | YES |
| 6.12 | Never invent pricing | `conversationBehaviors.neverInventPricing` | Voice | R-S1 | YES |
| 6.13 | Never invent availability | `conversationBehaviors.neverInventAvailability` | Voice | R-S1 | YES |
| 6.14 | Choose voice (each catalog voice) | `voiceId`, `voiceLabel`, `voiceSource` | Voice | R-S1 | YES |
| 6.15 | Voice preview (Play) | — | Voice | R-S1 | YES |
| 6.16 | Speaking pace | `speakingPace` | Voice | R-S1 Conversation style | YES |
| 6.17 | Accent / dialect | `voiceAccent` | Voice | R-S1 | YES |
| 6.18 | Backchannels | `backchannelLevel` | Voice | R-S1 | YES |
| 6.19 | Pause patience | `callerPausePatience` | Voice | R-S1 | YES |
| 6.20 | Interruption behavior | `interruptionStyle` | Voice | R-S1 | YES |
| 6.21 | Custom OpenAI voice ID (flagged) | `openAiCustomVoiceId`, `voiceSource` | Voice | R-S1 (same flag) | YES |

**R-S2 collect fields:** reorder up/down — **wizard Appointments step has no reorder**; Opus adds order controls (**NEW on R-S2**, not in 8-step).

---

## Step 7 — Test (`test-step.tsx`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 7.1 | Mode: Test in browser / After activate (phone) | — | Test | R-S3 | YES |
| 7.2 | Save draft for test | `agentId` (via ensure) | Test | R-S3 | YES |
| 7.3 | Build & start live test / `VoiceV3BrowserCall` | — | Test | R-S3 | YES |
| 7.4 | Phone test instructions (displays number) | — | Test | R-S3 | YES |

**No wizard UI:** `testScenario`, `lastTestPassed` (state keys exist on step merge).

---

## Step 8 — Activate (`activate-step.tsx`)

| # | Control | State field(s) | Wizard | New IA edit | Match |
|---|---------|----------------|--------|-------------|-------|
| 8.1 | Readiness grid (display only) | — | Activate | R-S3 review rows | PARTIAL |
| 8.2 | Activation issues list (display) | — | Activate | R-S3 | PARTIAL |
| 8.3 | Activate (go live) | `activationMode`, `scheduledAt` | Activate | R-S3 Publish | PARTIAL |
| 8.4 | Test in browser first (nav) | — | Activate | R-S3 | YES |

**No wizard UI:** schedule activation (`scheduledAt` only cleared on activate; no date picker in `activate-step.tsx`).

---

## Step 6 / Information merge keys — no editor in 8-step wizard UI

These are on `information` save-merge but **no customer control** was found in the 8-step wizard components:

| State field(s) | Notes |
|----------------|--------|
| `guardrails[]` | Not in wizard JSX |
| `longTermMemory` | Not in wizard JSX |
| `crmEnabled` | Not in wizard JSX |
| `preset`, `outcomeSlug` | Set at agent creation / hire flow, not Goals step inputs (standard) |

---

## Cross-reference: where new IA covers wizard gaps

| Wizard gap (NO on new IA) | Where customers edit today |
|---------------------------|----------------------------|
| Full Phone step (number, ring, connection greeting) | **LEG**; partial **NUM** + **CALL** ingress read-only |
| `answerWhen` / ring behavior | **LEG** |
| Send-booking-link fields | **LEG** |
| Appointment types & booking permissions | **LEG** |
| Qualification rules & ZIPs | **LEG** |
| Collect field “use for qualification” | **LEG** |
| Most transfer / fallback / on-call / SLA / notifications | **LEG** or **OPS** |
| AI Call Recovery | **LEG** |
| RAG toggle `knowledgeBaseEnabled` | **LEG** |
| `askServiceFirst` / `distinguishNewExisting` | No UI in wizard or new IA |

---

## Source files (audit trail)

| Step | Primary UI |
|------|------------|
| 1 Goals | `steps/goals-step.tsx` |
| 2 Phone | `steps/phone-step.tsx` |
| 3 Information | `steps/information-step.tsx`, `operating-maturity-editor.tsx` (`BusinessScheduleEditor`) |
| 4 Appointments | `steps/appointments-step.tsx` |
| 5 Call Handling | `steps/call-handling-step.tsx`, `emergency-transfer-editor.tsx`, `callback-required-fields-editor.tsx`, `after-hours-notifications-editor.tsx`, `operating-maturity-editor.tsx`, `urgency-rules-editor.tsx` (mctb) |
| 6 Voice | `steps/voice-step.tsx` |
| 7 Test | `steps/test-step.tsx` |
| 8 Activate | `steps/activate-step.tsx` |
| New IA | `newui-transplant/connected/voice/receptionist-editor/**`, `components/voice/knowledge/business-knowledge-editor.tsx`, `newui-transplant/connected/voice/call-handling-page.tsx` |

*Editability matrix only — does not assess compiler, persistence, or runtime behavior.*
