# AI Receptionist — complete code feature inventory

**Method:** Derived only from repository source (no checklist docs).  
**Generated:** 2026-09-22  
**Git SHA at generation:** `4f3ef5b67a52290589a0195f7edb9bf0e0a7ac2a`  
**Scope:** AI After Hours / appointment receptionist / `VoiceAgent` / Voice V3 (GPT-Live + LiveKit) / legacy Telnyx assistant paths / shared `/voice/*` surfaces.  
**Excluded:** MCTB-only TeXML/SMS recovery runtime (except shared number-capability flags and post-call MCTB hook stubs).

Use this file as the single copy-paste inventory. Appendices list every wizard control path, platform capability id, and Telnyx catalog tool key.

---

## 1. Product identity and shell

| Item | Code location / behavior |
|------|---------------------------|
| Product display name | `AI_AFTER_HOURS_DISPLAY_NAME` — `src/lib/products/ai-after-hours.ts` |
| Entitlement | `isAiAfterHoursEntitled(hasVoice)` — internal commercial key `ai_receptionist` |
| Primary nav | `buildAiAfterHoursNav` — `src/lib/products/ai-after-hours-nav.ts` |
| Mobile nav | `buildAiAfterHoursMobileNav` |

**Nav destinations (AI After Hours):** Overview · AI Agent (About, Capabilities, Integrations, Advanced, Voice & Test) · Calls · Knowledge · Call Handling · Numbers · account settings (shared).

---

## 2. UI routes (`src/app/(app)/voice/**`)

### 2.1 In AI After Hours nav

- `/voice/overview`
- `/voice/agents`, `/voice/agents/new`
- `/voice/agents/[id]/about`, `/capabilities`, `/integrations`, `/advanced`, `/voice-test`
- `/voice/calls`, `/voice/calls/[id]`
- `/voice/knowledge`
- `/voice/inbound-routing`
- `/voice/numbers`, `/voice/numbers/buy`

### 2.2 Same product namespace (pages exist; not all in AI After Hours nav)

- `/voice/analytics`, `/voice/analytics/after-hours`
- `/voice/operations`
- `/voice/needs-attention`
- `/voice/callback-requests`
- `/voice/voicemail`
- `/voice/conversations`
- `/voice/settings`, `/voice/setup`, `/voice/billing`
- `/voice/calendars`
- `/voice/tools`
- `/voice/campaigns`
- `/voice/ai-platform`
- `/voice/receptionist`
- `/voice/testing`, `/voice/try-it`
- `/voice/transcription`, `/voice/reports`, `/voice/consent-log`, `/voice/schedule`
- `/voice/missed-calls`, `/voice/missed-calls/[id]` (legacy/MCTB-adjacent in same tree)

### 2.3 MCTB shell reuse (same wizard, different chrome)

- `/mctb/voice-agent?step=goals|phone|information|booking|call-handling|voice|test|activate` — `MCTB-VOICE-AGENT-ZERO-FEATURE-LOSS-MATRIX.md` maps controls

### 2.4 Public / embed APIs (customer-facing)

- `POST/GET` — `/api/public/voice/widget/session`, `/api/public/voice/widget/chat`
- `/api/public/voice/mcp`

---

## 3. HTTP APIs (`src/app/api/voice/**` — 59 route files)

**Agents:** `agents`, `agents/[id]`, `knowledge`, `tools`, `test`, `test-session`, `v3-wizard-live-test`, `latency-profile`, `flows`, `flows/generate`, `flows/optimize`

**Calls & media:** `calls`, `calls/[id]`, `recordings/[id]/stream`, `recordings/[id]/url`, `caller-history`, `tts-preview`, `voices`

**Knowledge:** `knowledge`, `knowledge/crawl/[jobId]`, `knowledge/[id]`, `search`, `upload`, `sources`, `sources/[sourceId]`

**Calendars:** `calendars`, `calendars/availability`, OAuth `google` + `microsoft` (+ callbacks)

**Routing & ops:** `routing`, `routing/[id]`, `routing/simulate`, `inbound-routing` (page), `needs-attention`, `settings`, `overview`, `livekit/readiness`

**Platform:** `analytics`, `analytics/export`, `billing`, `campaigns`, `campaigns/[id]`, `conversations`, `conversations/[id]`, `staff`, `staff/[id]`, `services`, `services/[id]`, `templates`, `templates/test-session`, `telnyx-official-baseline`, `ai`, `tools`, `tools/send-resource`, `tools/search-details`, `tools/[id]/test`, `outbound/qualification/test`

**Wizard persist:** `POST /api/solutions/appointment-receptionist` — `save_draft` | `activate` | `create_draft`

**Telnyx tool webhook:** `/api/telnyx/voice/tools` — builtin catalog tools + legacy workflow tool names + Voice V3 delegation path

**Python worker bridge:** `/api/internal/voice-runtime` — `resolve_voice_v3_livekit_session`, `execute_voice_v3_livekit_tool`, `commit_voice_v3_livekit_caller_utterance`, `record_voice_v3_transfer_outcome`, `append_voice_v3_forensic_events`, `flush_voice_v3_forensics`

**TeXML / PSTN ingress:** `/api/telnyx/voice/v3-basic`, `/api/telnyx/voice/tools`, voice webhooks in `src/lib/voice/telnyx/webhook-handlers.ts`

---

## 4. Appointment Receptionist wizard (8 steps)

| Step | ID | Primary UI |
|------|-----|------------|
| 1 | `goals` | `goals-step.tsx` — capabilities, answer-when, solution name |
| 2 | `phone` | `phone-step.tsx` — number, greeting, recording, ring behavior |
| 3 | `information` | `information-step.tsx` — KB, website scan/crawl, uploads, guided profile |
| 4 | `appointments` | `appointments-step.tsx` — calendar, types, booking strategy |
| 5 | `call-handling` | `call-handling-step.tsx` — transfer, urgency, qualification, callbacks, AI recovery, memory, CRM |
| 6 | `voice` | `voice-step.tsx` — persona, GPT-Live voice, live prompt controls |
| 7 | `test` | `test-step.tsx` — scenarios, Quality Studio summary, `VoiceV3BrowserCall` |
| 8 | `activate` | `activate-step.tsx` — checklist, publish, schedule, draft |

**Shared editors:** `operating-maturity-editor`, `urgency-rules-editor`, `emergency-transfer-editor`, `after-hours-notifications-editor`, `callback-required-fields-editor`, `wizard-stepper`, `wizard.tsx`

**Activation validation:** `getWizardActivationIssues`, `transferWizardValidationIssues`, `APPOINTMENT_RECEPTIONIST_WIRING` — `capability-checklist.ts`, `transfer-activation-validation.ts`

---

## 5. Wizard capability toggles (8)

From `CapabilityId` / `CAPABILITY_OPTIONS`:

1. `answer_questions`
2. `book_appointments`
3. `reschedule`
4. `cancel`
5. `take_messages`
6. `qualify_callers`
7. `transfer_calls`
8. `send_sms_confirmations`

Compiled to `VoiceV3CapabilityFlags` in `agent-config.ts`.

---

## 6. When AI answers (`AnswerWhen` + telephony)

- `every_call`, `nobody_answers`, `after_hours`, `line_busy`, `custom_schedule`
- `ringBehavior`: `ai_immediate`, `ring_team_first`, `after_hours`, `custom`, `line_busy`
- `ringTeamSeconds`
- Inbound: `evaluateInboundRouting`, `resolveEffectiveAction`, `resolveInboundAiAgent`, `claimAiStart`
- AI start failure: spoken apology + structured message fallback (`handleAiAssistantStartFailure`)

---

## 7. Phone, SMS, and recording

- **Number source:** `existing`, `buy_new`, `connect_existing`, `forward_existing`
- **Assign:** `phoneNumberId`, `phoneNumberE164`
- **Outbound SMS for voice tools:** `outboundSmsMode` (`auto`, `workspace_preferred`, `same_as_voice_line`, `explicit_number`), `outboundSmsPhoneNumberId`, `outboundSmsE164`
- **Connection greeting:** `none`, `transovo_professional`, `transovo_warm`, `upload_custom`, `create_custom` + `connectionGreetingText`, `connectionGreetingAudioUrl`
- **Recording:** `off`, `all`, `inbound_only` + disclosure in compliance (`shouldStartCallRecording`)
- **Number purchase / assign:** `/voice/numbers`, `finalizeNumberOwnership` integration

---

## 8. Knowledge and RAG

**Sources (`KnowledgeSource`):** `website`, `guided_profile`, `upload_docs`, `connect_data`

**Knowledge items:** labels, summaries, statuses (`complete`, `warning`, `missing`, `optional`, `pending_review`, `extracted`, `owner_approved`, `rejected`, `outdated`)

**Large KB:** `knowledgeBaseEnabled`, `knowledgeBaseRevision`, `linkedKnowledgeBaseId`

**Ingestion paths:**

- Single-URL `scan_website` on `/api/voice/knowledge`
- Multi-page crawl: `src/lib/voice-v3/knowledge/website-crawl/*` (sitemap, same-origin, prioritize, SSRF guard, `MAX_USEFUL_PAGES` = 100), job poll `/api/voice/knowledge/crawl/[jobId]`, UI `VoiceWebsiteCrawlProgress`
- Document upload: `/api/voice/knowledge/[id]/upload`, sources CRUD
- Telnyx KB processor: `knowledge-processor.ts`
- OpenAI vector stores + GPT-Live **FileSearch**: `gpt-live-file-search-rag.ts`, wired in `voice-v3-livekit.ts` as `openaiFileSearchVectorStoreIds`
- Hot FAQ prompt injection: wizard `knowledgeItems` → `VoiceV3HotBusinessContext`
- Runtime instructions: `astra-knowledge-instructions.ts` (file_search vs hot context)

**Legacy Telnyx tool name (prompts/workflow):** `voice_v2_search_knowledge`

---

## 9. Booking strategies and calendar

**Strategies (`VoiceWizardBookingStrategy`):** `NONE`, `REQUEST_ONLY`, `SEND_LINK`, `MICROSOFT_365`, `CALENDLY`

**Per appointment type:** name, duration, calendar label, status, location, modality, description, booking hours prose, min notice, max days ahead, required fields, `bookingPermission` (`book_directly`, `suggest_then_confirm`, `send_booking_link`, `waitlist`, `require_deposit`), enabled

**Booking behavior:** askPreferredDayFirst, offerEarliestThree, confirmBeforeBooking, sendSmsAfterBooking, askServiceFirst, distinguishNewExisting

**Send link:** `bookingLinkUrl`, `bookingLinkLabel`, `bookingLinkSmsConsentRequired`, verbal consent recording (`booking-link/record-verbal-consent.ts`, `spoken-disclosure.ts`)

**Calendly wizard fields:** event type URI/name/duration/timezone (manifest scope `FUTURE_CALENDLY` on V3 path)

**Calendar OAuth / APIs:** Google + Microsoft routes under `/api/voice/calendars/*`

**Microsoft V3 execution:** find availability, book, find existing, reschedule, cancel, Graph datetime adapters, durable booking store, offer sets, slot selection, verbal confirmation (`booking/verbal-confirmation.ts`), idempotency tables (`voice_v2_booking_idempotency`, `voice_v2_offer_sets`)

**Google:** types reference `google` provider; **no `src/lib/voice-v3/calendar/google/` implementation tree on this SHA**

**Calendly runtime:** strategy + config compile; slot map helper `calendly-slot-map.ts` (live FIND/BOOK path is Microsoft-first in V3 catalog gating)

---

## 10. Intake, objectives, and conversation engine (Voice V3)

**Collect fields (defaults):** `full_name`, `phone`, `email`, `service`, `address`, `notes` — custom keys supported via wizard

**Intake field types:** text, email, phone, number, date, time  
**Collection strategies:** standard, voice_email, voice_phone, voice_address, voice_date

**V3 tool:** `update_intake` + optional per-field LiveKit schemas (`livekit-intake-tool-schemas.ts`)

**Intake-objective module:** derive/validate/merge objective, operation requirements, intake context, caller meaning schema (`voice_v3_caller_meaning`), semantic disposition, caller turn buffer/manager, conversation revision, delegation freshness

**Dialog goals (`VoiceV3Goal`):** GENERAL, BOOK_APPOINTMENT, REQUEST_CALLBACK, RESCHEDULE_APPOINTMENT, CANCEL_APPOINTMENT, REQUEST_TRANSFER, UNKNOWN

**Agent cognition (code modules):** goal manager, goal invalidation, evaluate goals/claims/requirements/operations, agent planner, escalation, recovery evaluate/sync, choose-next-conversation-action, confirmation policy, async operations registry, authoritative operation runner

**Scheduling:** `set_scheduling_preference`, scheduling meaning merge/normalizer, timezone helpers, clarification

**Legacy Telnyx intake (still referenced):** `voice_v2_save_intake_fields`, `record_current_field`, `save_collected_fields`, `continue_workflow`, `get_runtime_context`, `get_workflow_requirements`, `voice_v2_finalize_caller_request`, `voice_ai_booking_turn`, `calendar_availability`, hold/release slot tools

---

## 11. Qualification, urgency, spam/vendor

- Qualification enable/required, zip codes, rules ALL/ANY, not-qualified and needs-review fallbacks
- Rule operators: IN, NOT_IN, EQUALS, GTE, LTE, EXISTS, CONTAINS (`deterministic-rules.ts`)
- Service policy gates before FIND/BOOK (`service-policy.ts`)
- Urgency rules: severity, actions (CONTINUE, TAKE_MESSAGE, CALLBACK, REQUEST_ONLY, SEND_LINK, TRANSFER, END_POLITELY)
- Sales solicitation filter: `salesSolicitationEnabled`, actions CONTINUE_NORMALLY, TAKE_MESSAGE, DECLINE_POLITELY
- Caller classification: UNKNOWN, CUSTOMER, VENDOR_SALES, SPAM

---

## 12. Transfer and handoff

- Single destination (legacy): name, phone, ring seconds, `transferFallback`
- Multi-destination + waterfall: `transferDestinations[]`, `transferPlanSteps[]`, `defaultTransferPlanId`, routing `single` | `waterfall`
- Modes: BASIC, WARM; `warmTransfer`, `detectVoicemailOnTransfer`
- `voiceV2HumanTransferEnabled`, `allowCallerRequestedTransfer`, `transferTriggers[]` (free text)
- V3 `transfer_call` + Python `transfer_executor.py` (direct, warm, waterfall)
- Warm consult webhook state: `voice_v2_warm_transfer_consult`
- Job: `voice_v2_warm_transfer_timeout`
- Handoff summary for warm transfer (`build-handoff-summary.ts`)
- Publish validation: `validate-transfer-publish.ts`
- Telnyx native: `transfer`, `handoff`, `escalate_human`, `sip_refer`

---

## 13. Callbacks, requests, and messages

- Callback settings: enabled, ANI default, ask preferred time, confirm number, required collect field ids
- Tools: `request_callback`, `submit_appointment_request` (REQUEST_ONLY)
- Persistence: `CallbackRequest`, appointment request records, structured outcomes enum
- Message taking: `take_structured_message`, Python `take_message` / `persist_message`
- Post-call staff notify: `notifyReceptionistStaff` (`processPostCall`)

---

## 14. Operating maturity (hours, on-call, SLA, quality)

Pinned `operatingMaturity` on wizard:

- Weekly schedule + holidays + timezone
- After-hours when-closed behavior flags (live booking, callback, message, on-call escalation, office transfer, normal destinations)
- On-call schedule entries
- Callback SLA normal/urgent targets
- `resolveVoiceV2OperatingState`, behavior gating
- Friction signals (realtime + post-call LLM classifier)
- Resolution audit normalization
- After-hours analytics aggregation
- Job: `voice_v2_callback_sla_overdue_scan`
- **Quality Studio** scenarios (built-in ids): new_lead, faq_only, live_booking, booking_correction, reschedule, cancel, request_only, send_link, existing_customer, multi_field_sentence, custom_fields, field_correction, urgent_caller, human_request, unknown_policy, provider_failure, warm_transfer_accept, warm_transfer_no_answer, waterfall_failure, callback_creation, ai_refusal, booking_hangup, prompt_injection, spam_vendor, after_hours_state, holiday_state, on_call_escalation

---

## 15. Staff notifications (after-hours)

Events: `callback.requested`, `emergency`, `transfer.failed`, `transfer.connected`, `appointment.booked`, `appointment.changed`, `call.completed`  
Channels: SMS + email per event; recipient list with per-channel toggles  
Dispatch: callback, booking, transfer outcome, call completed (`notifications/*`)

---

## 16. AI call recovery (voice → SMS)

- `aiCallRecoveryEnabled`, consent mode, sending number, continue over SMS, delay, send when callback created
- Settle job: `voice_v2_ai_call_recovery_settle`
- Module: `voice-receptionist-wizard/ai-call-recovery/*`

---

## 17. Voice persona and GPT-Live controls

- Identity: agentName, businessName, role, tone, speakingStyle, language
- speaksFirst, openingGreeting (template variables)
- conversationBehaviors + guardrails[]
- Built-in GPT-Live voices: `VOICE_V3_WIZARD_LIVE_VOICES`
- voiceSource builtin|custom, openAiCustomVoiceId
- Live prompt controls: speakingPace, voiceAccent, backchannelLevel, callerPausePatience, interruptionStyle
- Legacy deprecated: speakingSpeed, responsiveness, interruptionSensitivity
- Proactive greeting / deferred recovery speak (`greeting/*`)
- Delegation config for OpenAI Live (`intake/delegation-config.ts`)

---

## 18. Activation, publishing, and agent lifecycle

- Modes: `activate_now`, `schedule`, `save_draft`, `duplicate_location`
- Test scenarios: business_question, price_question, appointment_booking, no_availability, transfer, frustrated, tool_failure
- `publishVoiceAgent`, rollback, Telnyx `assistant-sync`, `workflow-sync`
- Agent statuses: DRAFT, TESTING, ACTIVE, PAUSED, ARCHIVED, CONFIGURATION_ERROR
- `telnyxAssistantId`, compile: `compileReceptionistConfig`, `compile-voice-v3-agent-config.ts`
- `longTermMemory` → `VoiceMemoryConfig` / `voice_memory_configs`
- `crmEnabled` → expanded CRM tool set
- Agent types: receptionist, lead_qualification, appointment_booking, customer_support, outbound_follow_up, sales, collections, survey, custom
- Versioning sections in `VoiceAgentConfig`: versions, canary, scheduled, observability, tests, mcp, insights, postCall, compliance, security, platform, advanced
- Flows AI: `agents/[id]/flows/generate`, `flows/optimize`
- Latency profile API

---

## 19. Voice V3 runtime tools (canonical catalog)

| Tool | Purpose |
|------|---------|
| `update_intake` | Persist caller fields |
| `set_scheduling_preference` | Scheduling preference (Microsoft path) |
| `find_availability` | Slot search |
| `book_appointment` | Create booking |
| `find_appointment` | Lookup for manage |
| `reschedule_appointment` | Reschedule |
| `cancel_appointment` | Cancel |
| `transfer_call` | Human transfer |
| `end_call` | End session |
| `send_booking_link` | SMS link (SEND_LINK) |
| `request_callback` | Callback request |
| `submit_appointment_request` | REQUEST_ONLY |

**Runtime plumbing:** delegated Responses/Sol (`handle-delegated-voice-tools`, `live-response-coordinator`), tool idle filler (Python), concurrency policy, forensics + telemetry, provider failure map, pipeline boundary, runtime isolation

---

## 20. Transport and media

- **Default:** LiveKit Cloud GPT-Live (`MEDIA_BACKEND_MODE=livekit_cloud`) — Python `run_voice_v3_livekit_session`
- **Voice V3 Basic:** SIP/TeXML forward — `start-appointment-receptionist-pstn.ts`, `/api/telnyx/voice/v3-basic`, provisioning `route-phone-to-voice-v3-basic.ts`
- **Self-hosted LiveKit:** frozen constants (reference)
- **Legacy Telnyx assistant / Call Control:** partial; V2 shared booking tools removed (`voice_v2_booking_agent_removed`)
- **Legacy realtime bridge:** removed (`voice_v2_realtime_bridge_removed_use_voice_v3_basic`)
- Browser test: `VoiceV3BrowserCall` → `v3-wizard-live-test`
- LiveKit readiness endpoint

---

## 21. Python runtime (`voice-runtime-python/`)

**Production entrypoints:** `voice_v3_entrypoint` (GPT-Live V3), `legacy_entrypoint` (Amy template path)

**V3 session:** GPT-Live session, tool client → internal API, forensics, delegation telemetry, native end-call toolset, transfer executor, intake collection / active intake, telephony bridge

**Legacy Amy tools (`agent/tools.py`):** start_booking, take_message, check_availability, select_slot, confirm_booking, find_appointments, cancel_appointment, reschedule_appointment, get_business_answer, send_sms, transfer_to_human, end call

**Templates (registry):** basic_voice, frontdesk_booking, warm_transfer, structured_intake, hotel_receptionist, knowledge_rag, transovo_receptionist_v1 (composed, gated)

**Lab template tools:** list_slots, schedule_appointment, search_knowledge, record_field_value, etc.

**Note:** MCTB SIP paths in same worker (`mctb_*` modules) — not AI receptionist product features.

---

## 22. Telnyx builtin tool catalog (`TOOL_CATALOG` — 38 keys)

See **Appendix C**. Template bundles: `FULL_RECEPTIONIST_TOOLS`, per-`agentType` defaults in `catalog.ts`.

---

## 23. Platform capability map (`RECEPTIONIST_CAPABILITIES` — 51 ids)

Canonical layered map in `src/lib/voice/capabilities/receptionist-checklist.ts` — see **Appendix B** for every id, tier, and status.

Includes required receptionist, optional upgrades, booking-required, specialized variants (after_hours, overflow, missed_call, lead_qualification, customer_support, medical, legal, property_management), and other-solution hooks (outbound, campaigns, DTMF, payments, surveys, review requests, appointment reminders).

**Activate hooks (solution stubs in code):** medical, legal, property management, outbound, campaigns, surveys, review requests, appointment reminders, after-hours, overflow, missed-call, customer-support, lead-qualification — via `activate-hooks.ts` / shared receptionist hooks.

---

## 24. Call lifecycle, post-call, and observability

**Jobs:**

- `voice_v3_call_history`
- `voice_v2_post_call_transcription`
- `voice_v2_ai_call_recovery_settle`
- `voice_v2_warm_transfer_timeout`
- `voice_v2_callback_sla_overdue_scan`

**Post-call (`processPostCall`):** V3 call-history pipeline, Telnyx transcript sync, usage metering, automation enroll, platform events, insight extraction, staff notifications, optional MCTB trigger hook on missed inbound

**Call history pipeline:** native transcript from forensics, Deepgram fallback, AI summary, recording ingest/start, channel semantics validator

**UI/ops:** customer activity feed from tool executions, caller history API, needs-attention queue, callback requests list, call detail recording/transcript/summary states

**Telemetry:** voice tool executions, call forensics, caller turn timing, call trace summaries, transfer telemetry

---

## 25. Data model touchpoints (Prisma / compat)

Voice agent domain uses (non-exhaustive): `VoiceAgent`, `VoiceAgentVersion`, `VoiceCall`, `VoiceTranscript`, `VoiceRecording`, `VoiceToolExecution`, `VoiceKnowledgeBase`, knowledge sources, `CallbackRequest`, `voice_memory_configs`, booking idempotency / offer set tables, `SolutionSetup` for wizard persistence

---

## 26. Testing and simulation (code exists)

- Wizard test step + Quality Studio last run metadata
- Headless woodbridge fixture, conversation wizard profiles, text conversation driver, workflow tool executor
- Delegation freshness harness
- Cert/script entrypoints: `scripts/cert-voice-v3-*`, `scripts/test-voice-v3-*`, `test-ai-after-hours-cert.ts`, etc.

---

## 27. Second-pass additions (were easy to miss)

These exist in code but are not “wizard toggles”:

- **Intake-objective / agent planner / recovery blockers** — full `src/lib/voice-v3/intake-objective/*`, `agent/*`, `recovery/*`
- **Offer sets + slot revalidation** — `calendar/offer-set.ts`, `revalidate-selected-slot.ts`, `apply-slot-selection.ts`
- **Appointment discovery identity/window/match** — disambiguation for reschedule/cancel
- **Wizard manifest invariant** — every customer control path must map to `WIZARD_V3_FIELD_MANIFEST` row
- **209 customer-editable wizard paths** — Appendix A (auto-generated from `wizard-control-inventory.ts`)
- **51 platform `RECEPTIONIST_CAPABILITIES`** — Appendix B
- **Flows generate/optimize** and **latency-profile** agent APIs
- **Voice campaigns** page + API
- **AI platform** page (`ai-platform.ts` capability labels)
- **Public widget + MCP** routes
- **Automation enroll** on post-call
- **Website crawl UI** poll component shared by wizard + `/voice/knowledge`
- **Emergency transfer editor** and **after-hours notifications editor** components
- **Unsupported agent** handling (`unsupported-voice-agent.ts`)
- **GPT-Live wizard audit** (`gpt-live-wizard-audit.ts`)

---

## 28. Explicit non-features / retired paths (still mentioned in code)

- V2 shared FIND/BOOK Telnyx tool registration removed
- OpenAI realtime PSTN lean bridge removed
- `runtime_turn` legacy workflow tool blocked
- Google Calendar V3 provider module not present on this SHA (types only)
- Calendly V3 execution marked `FUTURE_CALENDLY` in manifest builder
- `voice-runtime/src/main.ts` legacy Node worker exits immediately (Python worker is production)

---

*End of narrative sections. Machine-readable lists follow.*
### Appendix A — Wizard customer-editable control paths (209)

- `capabilities.answer_questions`
- `capabilities.book_appointments`
- `capabilities.reschedule`
- `capabilities.cancel`
- `capabilities.take_messages`
- `capabilities.qualify_callers`
- `capabilities.transfer_calls`
- `capabilities.send_sms_confirmations`
- `answerWhen`
- `solutionName`
- `numberSource`
- `phoneNumberId`
- `phoneNumberE164`
- `outboundSmsMode`
- `outboundSmsPhoneNumberId`
- `outboundSmsE164`
- `ringBehavior`
- `ringTeamSeconds`
- `callRecording`
- `connectionGreeting`
- `connectionGreetingText`
- `connectionGreetingAudioUrl`
- `knowledgeSource`
- `websiteUrl`
- `linkedKnowledgeBaseId`
- `knowledgeBaseEnabled`
- `knowledgeBaseRevision`
- `businessName`
- `timezone`
- `operatingMaturity.businessSchedule.timezone`
- `operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowLiveBooking`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowCallbackRequest`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowMessageTaking`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowOnCallEscalation`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowOfficeTransfer`
- `operatingMaturity.afterHoursBehavior.whenClosed.allowNormalTransferDestinations`
- `calendarProvider`
- `calendarConnected`
- `calendarEmail`
- `selectedAppointmentTypeId`
- `bookingStrategy`
- `bookingLinkUrl`
- `bookingLinkLabel`
- `calendlyEventTypeUri`
- `calendlyEventTypeName`
- `calendlyEventTypeDurationMin`
- `calendlyTimezone`
- `bookingBehavior.askPreferredDayFirst`
- `bookingBehavior.offerEarliestThree`
- `bookingBehavior.confirmBeforeBooking`
- `bookingBehavior.sendSmsAfterBooking`
- `bookingBehavior.askServiceFirst`
- `bookingBehavior.distinguishNewExisting`
- `qualificationEnabled`
- `qualificationRequiredBeforePrimaryAction`
- `qualificationRevision`
- `qualificationSupportedZipCodes[]`
- `qualificationRulesMatchMode`
- `qualificationNotQualifiedFallback`
- `qualificationNeedsReviewFallback`
- `transferTriggers[]`
- `transferDestinationName`
- `transferDestinationPhone`
- `transferRingSeconds`
- `transferFallback`
- `warmTransfer`
- `detectVoicemailOnTransfer`
- `voiceV2HumanTransferEnabled`
- `allowCallerRequestedTransfer`
- `transferRouting`
- `defaultTransferPlanId`
- `urgencyEnabled`
- `callbackRequestsEnabled`
- `callbackUseAniByDefault`
- `callbackAskPreferredTime`
- `callbackConfirmNumber`
- `callbackRequiredCollectFieldIds`
- `salesSolicitationEnabled`
- `salesSolicitationAction`
- `aiCallRecoveryEnabled`
- `aiCallRecoveryConsentMode`
- `aiCallRecoverySendingPhoneNumberId`
- `aiCallRecoveryContinueOverSms`
- `aiCallRecoveryDelaySeconds`
- `aiCallRecoverySendWhenCallbackCreated`
- `agentName`
- `role`
- `tone`
- `speakingStyle`
- `language`
- `speaksFirst`
- `openingGreeting`
- `voiceId`
- `voiceLabel`
- `speakingPace`
- `voiceAccent`
- `backchannelLevel`
- `callerPausePatience`
- `interruptionStyle`
- `voiceSource`
- `openAiCustomVoiceId`
- `guardrails[]`
- `testScenario`
- `lastTestPassed`
- `activationMode`
- `scheduledAt`
- `longTermMemory`
- `crmEnabled`
- `qualityStudioLastRun`
- `agentId`
- `setupId`
- `outcomeSlug`
- `preset`
- `telnyxAssistantId`
- `collectFields[].id`
- `collectFields[].label`
- `collectFields[].required`
- `collectFields[].enabled`
- `collectFields[].useForQualification`
- `appointmentTypes[].id`
- `appointmentTypes[].name`
- `appointmentTypes[].durationMin`
- `appointmentTypes[].calendar`
- `appointmentTypes[].status`
- `appointmentTypes[].location`
- `appointmentTypes[].modality`
- `appointmentTypes[].description`
- `appointmentTypes[].bookingHours`
- `appointmentTypes[].minNotice`
- `appointmentTypes[].maxDaysAhead`
- `appointmentTypes[].requiredFields[]`
- `appointmentTypes[].bookingPermission`
- `appointmentTypes[].enabled`
- `knowledgeItems[].id`
- `knowledgeItems[].label`
- `knowledgeItems[].summary`
- `knowledgeItems[].status`
- `knowledgeItems[].statusLabel`
- `qualificationRules[].id`
- `qualificationRules[].fieldKey`
- `qualificationRules[].operator`
- `qualificationRules[].value`
- `qualificationRules[].resultStatus`
- `qualificationRules[].reasonCode`
- `qualificationRules[].reasonLabel`
- `urgencyRules[].id`
- `urgencyRules[].label`
- `urgencyRules[].fieldKey`
- `urgencyRules[].operator`
- `urgencyRules[].value`
- `urgencyRules[].severity`
- `urgencyRules[].action`
- `urgencyRules[].transferPlanId`
- `urgencyRules[].fallbackAction`
- `transferDestinations[].id`
- `transferDestinations[].label`
- `transferDestinations[].phoneE164`
- `transferDestinations[].enabled`
- `transferPlanSteps[].order`
- `transferPlanSteps[].destinationId`
- `transferPlanSteps[].transferMode`
- `transferPlanSteps[].timeoutSeconds`
- `operatingMaturity.businessSchedule.weekly.monday.closed`
- `operatingMaturity.businessSchedule.weekly.monday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.monday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.tuesday.closed`
- `operatingMaturity.businessSchedule.weekly.tuesday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.tuesday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.wednesday.closed`
- `operatingMaturity.businessSchedule.weekly.wednesday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.wednesday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.thursday.closed`
- `operatingMaturity.businessSchedule.weekly.thursday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.thursday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.friday.closed`
- `operatingMaturity.businessSchedule.weekly.friday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.friday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.saturday.closed`
- `operatingMaturity.businessSchedule.weekly.saturday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.saturday.ranges[].end`
- `operatingMaturity.businessSchedule.weekly.sunday.closed`
- `operatingMaturity.businessSchedule.weekly.sunday.ranges[].start`
- `operatingMaturity.businessSchedule.weekly.sunday.ranges[].end`
- `operatingMaturity.businessSchedule.holidays[].id`
- `operatingMaturity.businessSchedule.holidays[].name`
- `operatingMaturity.businessSchedule.holidays[].startDate`
- `operatingMaturity.businessSchedule.holidays[].endDate`
- `operatingMaturity.businessSchedule.holidays[].closedAllDay`
- `operatingMaturity.onCallSchedule.enabled`
- `operatingMaturity.onCallSchedule.entries[].id`
- `operatingMaturity.onCallSchedule.entries[].name`
- `operatingMaturity.onCallSchedule.entries[].dayOfWeek`
- `operatingMaturity.onCallSchedule.entries[].date`
- `operatingMaturity.onCallSchedule.entries[].startTime`
- `operatingMaturity.onCallSchedule.entries[].endTime`
- `operatingMaturity.onCallSchedule.entries[].destination.label`
- `operatingMaturity.onCallSchedule.entries[].destination.phoneE164`
- `operatingMaturity.onCallSchedule.entries[].priority`
- `operatingMaturity.onCallSchedule.entries[].enabled`
- `operatingMaturity.callbackSla.normalTarget`
- `operatingMaturity.callbackSla.normalCustomMinutes`
- `operatingMaturity.callbackSla.urgentTarget`
- `operatingMaturity.callbackSla.urgentCustomMinutes`
- `conversationBehaviors.keepBrief`
- `conversationBehaviors.oneQuestionAtATime`
- `conversationBehaviors.confirmDetails`
- `conversationBehaviors.neverInventPricing`
- `conversationBehaviors.neverInventAvailability`

### Appendix B — RECEPTIONIST_CAPABILITIES (51)

- **identity** — Business & solution identity (tier: required_receptionist, status: wizard_wired)
- **phone_connection** — Phone-number connection & answering behavior (tier: required_receptionist, status: wizard_wired)
- **call_opening** — Immediate call opening / connection greeting (tier: required_receptionist, status: live)
- **voice** — Voice configuration + telephone test (tier: required_receptionist, status: wizard_wired)
- **speech_recognition** — Speech recognition (Deepgram Nova-3) (tier: required_receptionist, status: live)
- **core_instructions** — Core instructions & guardrails (tier: required_receptionist, status: wizard_wired)
- **business_knowledge** — Business knowledge sources (tier: required_receptionist, status: wizard_wired)
- **knowledge_retrieval** — Knowledge retrieval tool (tier: required_receptionist, status: live)
- **intent_handling** — Basic caller-intent handling (tier: required_receptionist, status: wizard_wired)
- **collect_caller_info** — Caller-information collection (tier: required_receptionist, status: live); tools: save_caller_info, lookup_customer
- **message_taking** — Message taking + staff notify (tier: required_receptionist, status: live); tools: take_structured_message, create_task, mark_disposition
- **human_transfer** — Human transfer + failed-transfer fallback (tier: required_receptionist, status: live); tools: escalate_human, transfer
- **call_ending** — Hang-up and call ending (tier: required_receptionist, status: live); tools: hangup, end_call
- **recording** — Call recording setting (tier: required_receptionist, status: live)
- **transcript_history** — Transcript & conversation history (tier: required_receptionist, status: live)
- **post_call_summary** — Post-call summary & structured insights (tier: required_receptionist, status: live)
- **staff_notifications** — Staff notifications (tier: required_receptionist, status: wizard_wired)
- **call_history_ui** — Call history page (tier: required_receptionist, status: live)
- **reliability_security** — Reliability & security controls (tier: required_receptionist, status: wizard_wired)
- **connection_greeting_prerecord** — Prerecorded connection greeting (tier: optional_receptionist, status: live)
- **background_ambience** — Background ambience (tier: optional_receptionist, status: platform_ready)
- **multilingual** — Multiple languages (tier: optional_receptionist, status: wizard_wired)
- **multi_transfer_destinations** — Multiple transfer destinations (tier: optional_receptionist, status: platform_ready)
- **warm_transfer** — Warm transfer (tier: optional_receptionist, status: wizard_wired)
- **voicemail_detection** — Voicemail detection on transfer (tier: optional_receptionist, status: wizard_wired)
- **long_term_memory** — Long-term memory (tier: optional_receptionist, status: wizard_wired)
- **crm_connection** — CRM connection (tier: optional_receptionist, status: wizard_wired); tools: lookup_customer, search_crm_contacts, upsert_crm_contact, create_crm_note, create_crm_task
- **sms_followup** — SMS follow-up (tier: optional_receptionist, status: wizard_wired); tools: send_sms
- **ai_handoff** — AI handoff to another assistant (tier: optional_receptionist, status: platform_ready); tools: handoff
- **custom_workflows** — Custom visual workflows (tier: optional_receptionist, status: platform_ready)
- **calendar_connection** — Calendar connection (tier: required_booking, status: wizard_wired)
- **appointment_types** — Appointment types → voice services (tier: required_booking, status: wizard_wired)
- **availability_tool** — Availability tool (tier: required_booking, status: live); tools: calendar_availability
- **booking_tool** — Booking tool (tier: required_booking, status: live); tools: book_appointment
- **booking_conversation** — Booking conversation logic & guardrails (tier: required_booking, status: wizard_wired)
- **reschedule_cancel** — Reschedule / cancel appointments (tier: required_booking, status: live); tools: reschedule_appointment, cancel_appointment
- **after_hours** — After-hours receptionist rules (tier: specialized, status: wizard_wired)
- **overflow** — Overflow / ring-team-first (tier: specialized, status: wizard_wired)
- **missed_call** — Missed-call text-back receptionist (tier: specialized, status: wizard_wired)
- **lead_qualification** — Lead-qualification receptionist (tier: specialized, status: wizard_wired)
- **customer_support** — Customer-support receptionist (tier: specialized, status: wizard_wired)
- **medical** — Medical / HIPAA receptionist (tier: specialized, status: wizard_wired)
- **legal** — Legal intake receptionist (tier: specialized, status: wizard_wired)
- **property_management** — Property management receptionist (tier: specialized, status: wizard_wired)
- **outbound_dialing** — Outbound dialing / AMD (tier: other_solutions, status: platform_ready)
- **campaigns** — Campaigns / bulk lists (tier: other_solutions, status: platform_ready)
- **dtmf_navigation** — DTMF navigation (tier: other_solutions, status: live); tools: send_dtmf
- **payments** — Payment collection (tier: other_solutions, status: platform_ready)
- **surveys** — Surveys (tier: other_solutions, status: platform_ready)
- **review_requests** — Review requests (tier: other_solutions, status: platform_ready)
- **appointment_reminders** — Appointment reminders (tier: other_solutions, status: live)

### Appendix C — TOOL_CATALOG keys (38)

- **hangup** () — Hang up
- **transfer** () — Transfer
- **sip_refer** () — SIP Refer
- **send_dtmf** () — Send DTMF
- **end_call** () — End call (webhook)
- **send_resource** () — Send resource
- **search_business_details** () — Search business details
- **send_sms** () — Send SMS
- **record_call_fact** () — Record call fact
- **start_automation** () — Start automation
- **send_email** () — Send email
- **create_task** () — Create callback task
- **take_structured_message** () — Take structured message
- **mark_disposition** () — Mark call disposition
- **save_collected_fields** () — Save collected fields
- **record_current_field** () — Record current field
- **runtime_turn** () — Runtime turn
- **continue_workflow** () — Continue workflow
- **get_workflow_requirements** () — Get workflow requirements
- **get_runtime_context** () — Get runtime context
- **save_caller_info** () — Save caller information
- **update_contact_tags** () — Save caller tags
- **escalate_human** () — Escalate to human
- **lookup_customer** () — Recognize caller
- **search_crm_contacts** () — CRM contact search
- **create_crm_note** () — Create CRM note
- **create_crm_task** () — Create CRM follow-up task
- **upsert_crm_contact** () — Create/update CRM contact
- **resolve_datetime** () — Resolve date/time
- **calendar_availability** () — Check availability
- **voice_ai_booking_turn** () — Voice AI booking turn
- **book_appointment** () — Book appointment
- **hold_appointment_slot** () — Hold appointment slot
- **release_appointment_hold** () — Release appointment hold
- **find_appointments** () — Find appointments
- **reschedule_appointment** () — Reschedule appointment
- **cancel_appointment** () — Cancel appointment
- **handoff** () — Agent handoff