# Voice V3 audit — condensed (no full prompt bodies)

**Generated:** 2026-09-19T08:20:19.613Z  
Use **split files** or zip for full Amy/Astra prompt text. This file has path proof, comparison, wizard, traces, worksheet, and gaps only.

---

## Production path proof (Voice V3 PSTN)

| Stage | File | Symbol |
|-------|------|--------|
| HTTP | `src/app/api/openai/live/incoming/route.ts` | `POST` → `handleOpenAiLiveIncomingWebhook` |
| Webhook | `src/lib/voice-v3-basic/openai-live-webhook.ts` | `handleOpenAiLiveIncomingWebhook` |
| Config resolve | `src/lib/voice-v3/config/from-published-agent.ts` | `resolveVoiceV3AgentConfigForAgent` |
| Session build | `src/lib/voice-v3-basic/live-session-config.ts` | `buildBasicLiveSession` |
| Amy instructions | `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` | `buildLiveFrontendInstructions` |
| Astra delegation | `src/lib/voice-v3/intake/delegation-config.ts` | `buildVoiceV3AstraDelegationResponses` |
| OpenAI API | `openai-live-webhook.ts` | `client.live.sessions.accept` |

PSTN: `consumeRecentPstnLeg()` → `workspaceId` / `agentId` for per-agent config.

---

----|------|--------|
| HTTP | `src/app/api/openai/live/incoming/route.ts` | `POST` → `handleOpenAiLiveIncomingWebhook` |
| Webhook | `src/lib/voice-v3-basic/openai-live-webhook.ts` | `handleOpenAiLiveIncomingWebhook` |
| Config resolve | `src/lib/voice-v3/config/from-published-agent.ts` | `resolveVoiceV3AgentConfigForAgent` |
| Session build | `src/lib/voice-v3-basic/live-session-config.ts` | `buildBasicLiveSession` |
| Amy instructions | `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` | `buildLiveFrontendInstructions` |
| Astra delegation | `src/lib/voice-v3/intake/delegation-config.ts` | `buildVoiceV3AstraDelegationResponses` |
| OpenAI API | `openai-live-webhook.ts` | `client.live.sessions.accept` |

PSTN: `consumeRecentPstnLeg()` → `workspaceId` / `agentId` for per-agent config.

---

## PART 3 — Amy vs Astra context

| Information | Amy | Astra | Source | Field | Injection |
|-------------|-----|-------|--------|-------|-----------|
| Business name | Y | Y | wizard/config | businessName | Live instructions; Astra header |
| Agent name | Y (env) | N | VOICE_V3_AGENT_NAME | env | Live + greeting commentary |
| Timezone | N | Y | wizard | timezone | Astra header; FIND normalizer |
| Local datetime | N | Y | accept time | computed | Astra header |
| Intake catalog | N | Y | compileVoiceV2IntakeSchema | collectFields | Astra text + update_intake |
| Intake/runtime values | thinking | tools | update_intake | snapshot append | Shared |
| Availability slots | thinking | tool results | FIND | thinking append | Amy speaks |
| Delegation policy | Y | N | static | — | Live only |
| Cross-tool rules | N | Y | static | — | Astra |
| Business knowledge/RAG | N | N | KB/wizard | knowledge* | V2 only |
| Tone/role/guardrails | N | N | wizard | instructions.* | V2 only |

**Duplication:** business name in Amy + Astra + V2 system prompt; discipline themes in static Amy + Astra core.

**Neither model (V3):** tone, knowledgeItems, bookingBehavior, qualification, operatingMaturity prose, connectionGreeting.

---

## PART 4 — Wizard inventory (Steps 1–8)

Shell: `wizard.tsx` · State: `AppointmentReceptionistWizardState` (`types.ts` L116–302)  
Save: `POST /api/solutions/appointment-receptionist` → `buildWizardAgentConfig` · Snapshot: `advanced.appointmentReceptionistWizard`

| Step | ID | Component / fields |
|------|-----|-------------------|
| 1 | goals | capabilities, answerWhen, solutionName, preset |
| 2 | phone | numberSource, phone*, ring*, recording, connectionGreeting*, outboundSms* |
| 3 | information | businessName, timezone, knowledge*, website, uploads, operatingMaturity |
| 4 | appointments | bookingStrategy, calendar*, appointmentTypes, collectFields, bookingBehavior, qualification*, calendly/link |
| 5 | call-handling | transfer*, fallbacks, urgency/callback/sales, aiCallRecovery, longTermMemory, crmEnabled |
| 6 | voice | agentName, role/tone/style/language, greeting, behaviors, guardrails, voice*/sliders |
| 7 | test | testScenario, qualityStudioLastRun, telnyxAssistantId |
| 8 | activate | activationMode, scheduledAt |

Per-field worksheet: **PART 8** in `04-worksheet-and-gaps.md`.

---

## PART 5 — Wizard → V3 traces

| Field | Chain | V3 |
|-------|-------|-----|
| businessName | wizard → publish → from-published-agent → buildVoiceV3Prompts | Amy + Astra |
| timezone | wizard → VoiceV3AgentConfig.timezone | Astra + FIND |
| collectFields | voiceV2Intake → compileVoiceV2IntakeSchema → intakeFields | Astra + update_intake + book gates |
| appointmentTypes[enabled] | → service.id/name/durationMinutes | FIND/BOOK |
| calendar | voiceCalendarConnection | Microsoft adapter |
| agentName | identity.displayName | **SAVED NOT CONSUMED V3** (env) |
| openingGreeting | callHandling.greeting | **SAVED NOT CONSUMED V3** |
| knowledge* | KB + instructions.system | **SAVED NOT CONSUMED V3** |
| tone/role/guardrails/bookingBehavior | instructions | **SAVED NOT CONSUMED V3** |
| transfer* | transfers.* | V2 escalate; V3 transfer_call **partial** (no transferDestinations map) |

---

## PART 6 — File / knowledge features

| Feature | Step | API | V3 PSTN | Indexed |
|---------|------|-----|---------|---------|
| Website scan | 3 | POST /api/voice/knowledge scan_website | No | Yes |
| Doc upload | 3 | POST /api/voice/knowledge/:id/upload | No | Yes |
| Guided profile | 3 | wizard → Company Brain | No | Partial |
| Link KB | 3 | GET /api/voice/knowledge | No | Yes |
| knowledgeBaseEnabled | 3 | advanced.knowledge | No | When on |

No OpenAI Vector Store on V3 path.

---

## PART 7 — Authoritative configuration

| Layer | What |
|-------|------|
| Wizard draft | `draftConfig.advanced.appointmentReceptionistWizard` |
| Compiled | `VoiceAgentConfig` via `buildWizardAgentConfig` |
| Published | `VoiceAgentVersion.config` (`publishedVersionId`) |
| V3 slice | `VoiceV3AgentConfig` via `resolveVoiceV3AgentConfigForAgent` |
| Per-call | `VoiceV3CallRuntime` snapshot |

Accept reads **published** config at call time (not immutable snapshot). Loaded in `openai-live-webhook.ts` before `buildBasicLiveSessionAcceptParams`.


---

# PARTS 8–9 — Worksheet and gaps

**Generated:** 2026-09-19T08:20:19.613Z

## PART 8 — Master mapping worksheet

| Step | Field | Meaning | Persisted At | Consumer | Amy | Astra | Runtime | Provider | Unused? | Potential Destination |
|------|-------|---------|--------------|----------|-----|-------|---------|----------|---------|----------------------|
| 1 | capabilities | What Amy should do on calls | VoiceAgent draft/published config + advanced.actionPermissions | V2 Telnyx workflow/tools only | No (V3 Live) | No | V2 Telnyx workflow/tools only | Telnyx assistant publish | Partial for V3 PSTN | DETERMINISTIC_CONFIG, UNKNOWN_REQUIRES_DECISION |
| 1 | answerWhen | When AI answers | callHandling.answerMode + wizard snapshot | Ring/routing (V2) | No | No | Ring/routing (V2) | Telnyx | V3 OpenAI PSTN bypasses ring modes | PROVIDER_CONFIG |
| 1 | solutionName | Workspace label for agent | VoiceAgent.name | No | No | No | No | No | Yes for V3 voice | UNKNOWN_REQUIRES_DECISION |
| 1 | preset/outcomeSlug | URL preset seed | advanced.appointmentReceptionistWizard | No | No | No | No | No | Yes | UNKNOWN_REQUIRES_DECISION |
| 2 | numberSource | How inbound number is provisioned | wizard + telephony hooks | No | No | No | No | Telnyx number assignment | N/A telephony | PROVIDER_CONFIG |
| 2 | phoneNumberId/E164 | DID for PSTN | VoiceAgent phone + wizard | PSTN leg → agentId | No | No | PSTN leg → agentId | Telnyx | No | PROVIDER_CONFIG |
| 2 | ringBehavior/ringTeamSeconds | Human ring before AI | callHandling | V2 only | No | No | V2 only | Telnyx | V3 PSTN | PROVIDER_CONFIG |
| 2 | callRecording | Record calls | callHandling + compliance | V2 | No | No | V2 | Telnyx | V3 path unclear | PROVIDER_CONFIG |
| 2 | connectionGreeting* | Audio before AI | callHandling.startupGreeting | V2 TeXML/Telnyx | No (uses Live commentary greeting) | No | V2 TeXML/Telnyx | Telnyx | V3 uses requestInitialLiveGreeting | PROVIDER_CONFIG, LIVE_FRONTEND_CONTEXT |
| 2 | outboundSms* | SMS sender for confirmations | messaging | V2 send_sms tool | No | No | V2 send_sms tool | Telnyx SMS | V3 book path | TOOL/API_DATA |
| 3 | businessName | Public business name | identity + wizard + dynamicVariables | VoiceV3AgentConfig.businessName | Yes (if PSTN agent resolved) | Yes | VoiceV3AgentConfig.businessName | No | No | BOTH_MODEL_CONTEXTS |
| 3 | timezone | Business TZ | dynamicVariables + wizard + config.timezone | FIND/BOOK normalizer | No in prompt | Yes | FIND/BOOK normalizer | Microsoft calendar | Partial Amy | ASTRA_BACKEND_CONTEXT, DETERMINISTIC_CONFIG |
| 3 | knowledgeSource/websiteUrl | Business knowledge ingestion | advanced.knowledge + KB | V2 RAG + compileVoiceAgentPrompt | No V3 | No V3 | V2 RAG + compileVoiceAgentPrompt | KB index | V3 PSTN | RAG_CANDIDATE |
| 3 | knowledgeBaseEnabled | RAG during calls | advanced.knowledge | V2 retrieval tool | No | No | V2 retrieval tool | vector/KB | V3 | RAG_CANDIDATE |
| 3 | knowledgeItems | Structured business facts | wizard + Company Brain sync | V2 instructions.system Business knowledge | No V3 | No V3 | V2 instructions.system Business knowledge | No | V3 | RAG_CANDIDATE, BOTH_MODEL_CONTEXTS |
| 3 | linkedKnowledgeBaseId | Attach workspace KB | knowledgeBaseIds | V2 | No | No | V2 | KB storage | V3 | RAG_CANDIDATE |
| 3 | operatingMaturity | Operating maturity | advanced.voiceV2OperatingMaturity | V2 after-hours | No | No | V2 after-hours | No | V3 (businessHours env fallback) | DETERMINISTIC_CONFIG, RAG_CANDIDATE |
| 4 | bookingStrategy | Microsoft/Calendly/link/request | advanced.bookingStrategy | V3 assumes MICROSOFT_365 FIND/BOOK | No | No | V3 assumes MICROSOFT_365 FIND/BOOK | Microsoft/Calendly | Partial — V3 ignores non-Microsoft strategies | DETERMINISTIC_CONFIG |
| 4 | calendar* | Scheduling provider | voiceCalendarConnection + wizard | find_availability/book | No | No | find_availability/book | Microsoft Graph | No for V3 book | TOOL/API_DATA, PROVIDER_CONFIG |
| 4 | appointmentTypes | Services/durations | conversationFlow + wizard | service.name/duration (first enabled) | No | No | service.name/duration (first enabled) | Microsoft | Partial | DETERMINISTIC_CONFIG, TOOL/API_DATA |
| 4 | bookingBehavior | Conversation booking style | receptionistAdvanced.bookingPolicy + instructions | V2 workflow | No | No | V2 workflow | No | V3 | UNKNOWN_REQUIRES_DECISION |
| 4 | collectFields | Intake fields | voiceV2Intake + receptionistAdvanced.callerFields | book_appointment preconditions | No | Yes (catalog + update_intake schema) | book_appointment preconditions | No | No | ASTRA_BACKEND_CONTEXT, DETERMINISTIC_CONFIG |
| 4 | qualification* | Zip/rules gating | advanced.qualification | V2 | No | No | V2 | No | V3 | DETERMINISTIC_CONFIG |
| 4 | bookingLink/calendly* | Non-Microsoft booking | advanced | V2 modes | No | No | V2 modes | Calendly/HTTP | V3 PSTN Microsoft path | TOOL/API_DATA |
| 5 | transfer* | Human transfer | transfers + receptionistAdvanced.transferPolicy | transfer_call executor | Policy mentions transfer (delegation) | transfer_call tool (destinations often empty in V3 config) | transfer_call executor | Telnyx | Partial — from-published-agent does not map wizard transfer to VoiceV3AgentConfig.transferDestinations | DETERMINISTIC_CONFIG, TOOL/API_DATA |
| 5 | urgency/callback/sales/aiCallRecovery | Escalation/recovery | advanced.voiceV2AfterHoursHandling, voiceV2AiCallRecovery | V2/MCTB recovery | No | No | V2/MCTB recovery | Telnyx/SMS | V3 | UNKNOWN_REQUIRES_DECISION |
| 5 | longTermMemory/crmEnabled | CRM tools | advanced + enabledBuiltinTools | V2 CRM tools | No | No | V2 CRM tools | CRM APIs | V3 | TOOL/API_DATA |
| 6 | agentName | Spoken agent name | identity.displayName + dynamicVariables | greeting.ts uses env defaults | Only via VOICE_V3_AGENT_NAME env unless wired | No | greeting.ts uses env defaults | No | Wizard value often not on V3 PSTN | LIVE_FRONTEND_CONTEXT |
| 6 | role/tone/speakingStyle/language | Style instructions | instructions.* + voiceLanguage | V2 instructions.system | No V3 (static Live prompt) | No | V2 instructions.system | Telnyx voice/STT | V3 persona frozen in live-frontend-instructions.ts | LIVE_FRONTEND_CONTEXT, UNKNOWN_REQUIRES_DECISION |
| 6 | openingGreeting/speaksFirst | First spoken line | callHandling.greeting | greeting.ts | Partial — commentary greeting uses env template not wizard text | No | greeting.ts | No | Wizard greeting often ignored on V3 | LIVE_FRONTEND_CONTEXT |
| 6 | conversationBehaviors/guardrails | Conversation rules | instructions + receptionistAdvanced | V2 | No (duplicated statically in Live prompt themes) | No | V2 | No | V3 | LIVE_FRONTEND_CONTEXT |
| 6 | voiceId/speed/responsiveness/interruption | TTS/STT behavior | voiceLanguage + transcription | No V3 | voice fixed marin in buildBasicLiveSession | No | No V3 | OpenAI Live audio.output.voice | Wizard voice picker not applied to V3 accept | PROVIDER_CONFIG |
| 7 | testScenario/lastTestPassed | QA checklist | wizard snapshot | No | No | No | No | Telnyx test assistant | Yes | UNKNOWN_REQUIRES_DECISION |
| 7 | qualityStudioLastRun | Publish blockers | wizard | No | No | No | No | No | Yes | UNKNOWN_REQUIRES_DECISION |
| 8 | activationMode/scheduledAt | Publish timing | VoiceAgent publish + advanced | Triggers publish | No | No | Triggers publish | No | N/A | DETERMINISTIC_CONFIG |

---

## PART 9 — Discrepancy list

**A.** Useful wizard fields → neither Amy nor Astra (V3): knowledge/RAG, tone/role/guardrails, bookingBehavior, qualification, operatingMaturity, connectionGreeting, recovery toggles.

**B.** Amy without wizard source: static delegation policy + conversation discipline in `live-frontend-instructions.ts`.

**C.** Astra without wizard source: core + cross-tool blocks; tool path ordering.

**D.** Duplicated: business name; “don’t invent” themes (Amy + Astra + V2 guardrails).

**E.** Saved unused V3: see PART 5 **SAVED NOT CONSUMED**.

**F.** Runtime not from wizard: `VOICE_V3_*` env, voice `marin`, default intake when schema empty.

**G.** Legacy: `instructions.system`, `enabledBuiltinTools`, `voiceV2PstnLiveBooking: false`.

**H.** Upload/knowledge not on V3 PSTN.

**I.** UI mismatch: agentName, greeting, voice, tone, transfer, non-Microsoft bookingStrategy may not change V3 accept behavior.

