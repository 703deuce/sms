# PARTS 3–7 — Compare, wizard, traces, knowledge, config

**Generated:** 2026-09-19T08:20:19.613Z

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
