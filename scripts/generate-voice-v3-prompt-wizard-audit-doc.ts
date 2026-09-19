/**
 * One-off generator for docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md
 * Audit-only — does not modify production runtime.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import { buildLiveDelegationPolicySection } from "../src/lib/voice-v3/prompts/live-delegation-policy";
import { buildAstraBackendCoreInstructions } from "../src/lib/voice-v3/prompts/astra-backend-core-instructions";
import { buildAstraIntakeInstructions } from "../src/lib/voice-v3/prompts/astra-intake-instructions";
import { buildAstraCrossToolInstructions } from "../src/lib/voice-v3/prompts/astra-cross-tool-instructions";
import { buildAstraBackendInstructions } from "../src/lib/voice-v3/prompts/astra-backend-instructions";
import * as contracts from "../src/lib/voice-v3/tools/astra-tool-contracts";
import { VOICE_TOOL_CATALOG } from "../src/lib/voice-v3/tools/voice-tool-catalog";

const amyTemplate = buildLiveFrontendInstructions({
  agentName: "{{agentName}}",
  businessName: "{{businessName}}",
});

const sampleCatalog = `- name (Name, type=text, required=true)
- email (Email, type=email, required=true)
- phone (Phone, type=phone, required=true)`;

const astraSample = buildAstraBackendInstructions({
  businessName: "{{businessName}}",
  timezone: "{{timezone}}",
  currentLocalDateTime: "{{currentLocalDateTime}}",
  intakeFieldCatalog: "{{intakeFieldCatalog}}",
  toolSurface: "capability_tools",
});

const toolRows = VOICE_TOOL_CATALOG.map((e) => {
  return `| \`${e.name}\` | \`src/lib/voice-v3/tools/voice-tool-catalog.ts\` → \`${e.buildOpenAiTool.name}\` | \`src/lib/voice-v3/tools/astra-tool-contracts.ts\` + per-tool Zod in \`src/lib/voice-v3/tools/*-tool.ts\` |`;
}).join("\n");

const contractBlock = Object.entries(contracts)
  .filter(([k]) => k.endsWith("_DESCRIPTION"))
  .map(([k, v]) => `### ${k}\n\n\`\`\`\n${String(v)}\n\`\`\``)
  .join("\n\n");

const wizardFields: Array<{
  step: number;
  field: string;
  section: string;
  label: string;
  meaning: string;
  ui: string;
  stateKey: string;
  persist: string;
  amy: string;
  astra: string;
  runtime: string;
  provider: string;
  unused: string;
  dest: string;
  files: string;
}> = [
  // Step 1 Goals
  { step: 1, field: "capabilities", section: "Goals", label: "Capabilities", meaning: "What Amy should do on calls", ui: "multi-select cards", stateKey: "capabilities", persist: "VoiceAgent draft/published config + advanced.actionPermissions", amy: "No (V3 Live)", astra: "No", runtime: "V2 Telnyx workflow/tools only", provider: "Telnyx assistant publish", unused: "Partial for V3 PSTN", dest: "DETERMINISTIC_CONFIG, UNKNOWN_REQUIRES_DECISION", files: "goals-step.tsx, build-agent-config.ts, wizard-advanced-bridge.ts" },
  { step: 1, field: "answerWhen", section: "Goals", label: "Operating mode", meaning: "When AI answers", ui: "radio", stateKey: "answerWhen", persist: "callHandling.answerMode + wizard snapshot", amy: "No", astra: "No", runtime: "Ring/routing (V2)", provider: "Telnyx", unused: "V3 OpenAI PSTN bypasses ring modes", dest: "PROVIDER_CONFIG", files: "goals-step.tsx, build-agent-config.ts" },
  { step: 1, field: "solutionName", section: "Goals", label: "Agent display name", meaning: "Workspace label for agent", ui: "text", stateKey: "solutionName", persist: "VoiceAgent.name", amy: "No", astra: "No", runtime: "No", provider: "No", unused: "Yes for V3 voice", dest: "UNKNOWN_REQUIRES_DECISION", files: "goals-step.tsx, appointment-receptionist/route.ts" },
  { step: 1, field: "preset/outcomeSlug", section: "Goals", label: "(hidden)", meaning: "URL preset seed", ui: "hidden", stateKey: "preset, outcomeSlug", persist: "advanced.appointmentReceptionistWizard", amy: "No", astra: "No", runtime: "No", provider: "No", unused: "Yes", dest: "UNKNOWN_REQUIRES_DECISION", files: "types.ts" },
  // Step 2 Phone
  { step: 2, field: "numberSource", section: "Phone", label: "Number source", meaning: "How inbound number is provisioned", ui: "select cards", stateKey: "numberSource", persist: "wizard + telephony hooks", amy: "No", astra: "No", runtime: "No", provider: "Telnyx number assignment", unused: "N/A telephony", dest: "PROVIDER_CONFIG", files: "phone-step.tsx, activate-hooks" },
  { step: 2, field: "phoneNumberId/E164", section: "Phone", label: "Inbound number", meaning: "DID for PSTN", ui: "picker", stateKey: "phoneNumberId, phoneNumberE164", persist: "VoiceAgent phone + wizard", amy: "No", astra: "No", runtime: "PSTN leg → agentId", provider: "Telnyx", unused: "No", dest: "PROVIDER_CONFIG", files: "phone-step.tsx" },
  { step: 2, field: "ringBehavior/ringTeamSeconds", section: "Phone", label: "Ring team first", meaning: "Human ring before AI", ui: "select + number", stateKey: "ringBehavior, ringTeamSeconds", persist: "callHandling", amy: "No", astra: "No", runtime: "V2 only", provider: "Telnyx", unused: "V3 PSTN", dest: "PROVIDER_CONFIG", files: "phone-step.tsx" },
  { step: 2, field: "callRecording", section: "Phone", label: "Call recording", meaning: "Record calls", ui: "select", stateKey: "callRecording", persist: "callHandling + compliance", amy: "No", astra: "No", runtime: "V2", provider: "Telnyx", unused: "V3 path unclear", dest: "PROVIDER_CONFIG", files: "phone-step.tsx" },
  { step: 2, field: "connectionGreeting*", section: "Phone", label: "Connection greeting", meaning: "Audio before AI", ui: "select + text/upload", stateKey: "connectionGreeting, connectionGreetingText, connectionGreetingAudioUrl", persist: "callHandling.startupGreeting", amy: "No (uses Live commentary greeting)", astra: "No", runtime: "V2 TeXML/Telnyx", provider: "Telnyx", unused: "V3 uses requestInitialLiveGreeting", dest: "PROVIDER_CONFIG, LIVE_FRONTEND_CONTEXT", files: "phone-step.tsx, greeting.ts" },
  { step: 2, field: "outboundSms*", section: "Phone", label: "Outbound SMS", meaning: "SMS sender for confirmations", ui: "select", stateKey: "outboundSmsMode, outboundSmsPhoneNumberId", persist: "messaging", amy: "No", astra: "No", runtime: "V2 send_sms tool", provider: "Telnyx SMS", unused: "V3 book path", dest: "TOOL/API_DATA", files: "phone-step.tsx" },
  // Step 3 Information
  { step: 3, field: "businessName", section: "Information", label: "Business name", meaning: "Public business name", ui: "text (also step 6)", stateKey: "businessName", persist: "identity + wizard + dynamicVariables", amy: "Yes (if PSTN agent resolved)", astra: "Yes", runtime: "VoiceV3AgentConfig.businessName", provider: "No", unused: "No", dest: "BOTH_MODEL_CONTEXTS", files: "information-step.tsx, from-published-agent.ts, build-voice-v3-prompts.ts" },
  { step: 3, field: "timezone", section: "Information", label: "Timezone", meaning: "Business TZ", ui: "select", stateKey: "timezone", persist: "dynamicVariables + wizard + config.timezone", amy: "No in prompt", astra: "Yes", runtime: "FIND/BOOK normalizer", provider: "Microsoft calendar", unused: "Partial Amy", dest: "ASTRA_BACKEND_CONTEXT, DETERMINISTIC_CONFIG", files: "information-step.tsx, from-published-agent.ts" },
  { step: 3, field: "knowledgeSource/websiteUrl", section: "Information", label: "Knowledge source / website", meaning: "Business knowledge ingestion", ui: "cards + URL", stateKey: "knowledgeSource, websiteUrl", persist: "advanced.knowledge + KB", amy: "No V3", astra: "No V3", runtime: "V2 RAG + compileVoiceAgentPrompt", provider: "KB index", unused: "V3 PSTN", dest: "RAG_CANDIDATE", files: "information-step.tsx, knowledge-config.ts" },
  { step: 3, field: "knowledgeBaseEnabled", section: "Information", label: "Search uploaded documents", meaning: "RAG during calls", ui: "toggle", stateKey: "knowledgeBaseEnabled", persist: "advanced.knowledge", amy: "No", astra: "No", runtime: "V2 retrieval tool", provider: "vector/KB", unused: "V3", dest: "RAG_CANDIDATE", files: "information-step.tsx" },
  { step: 3, field: "knowledgeItems", section: "Information", label: "Knowledge items", meaning: "Structured business facts", ui: "repeater/editor", stateKey: "knowledgeItems", persist: "wizard + Company Brain sync", amy: "No V3", astra: "No V3", runtime: "V2 instructions.system Business knowledge", provider: "No", unused: "V3", dest: "RAG_CANDIDATE, BOTH_MODEL_CONTEXTS", files: "information-step.tsx, sync-company-brain-from-wizard.ts" },
  { step: 3, field: "linkedKnowledgeBaseId", section: "Information", label: "Linked KB", meaning: "Attach workspace KB", ui: "select/upload", stateKey: "linkedKnowledgeBaseId", persist: "knowledgeBaseIds", amy: "No", astra: "No", runtime: "V2", provider: "KB storage", unused: "V3", dest: "RAG_CANDIDATE", files: "information-step.tsx, /api/voice/knowledge" },
  { step: 3, field: "operatingMaturity", section: "Information", label: "Hours / on-call / SLA", meaning: "Operating maturity", ui: "BusinessScheduleEditor", stateKey: "operatingMaturity", persist: "advanced.voiceV2OperatingMaturity", amy: "No", astra: "No", runtime: "V2 after-hours", provider: "No", unused: "V3 (businessHours env fallback)", dest: "DETERMINISTIC_CONFIG, RAG_CANDIDATE", files: "operating-maturity-editor.tsx" },
  // Step 4 Appointments
  { step: 4, field: "bookingStrategy", section: "Appointments", label: "Booking strategy", meaning: "Microsoft/Calendly/link/request", ui: "select cards", stateKey: "bookingStrategy", persist: "advanced.bookingStrategy", amy: "No", astra: "No", runtime: "V3 assumes MICROSOFT_365 FIND/BOOK", provider: "Microsoft/Calendly", unused: "Partial — V3 ignores non-Microsoft strategies", dest: "DETERMINISTIC_CONFIG", files: "appointments-step.tsx, booking-strategy.ts" },
  { step: 4, field: "calendar*", section: "Appointments", label: "Calendar connection", meaning: "Scheduling provider", ui: "connect UI", stateKey: "calendarProvider, calendarConnected, calendarEmail", persist: "voiceCalendarConnection + wizard", amy: "No", astra: "No", runtime: "find_availability/book", provider: "Microsoft Graph", unused: "No for V3 book", dest: "TOOL/API_DATA, PROVIDER_CONFIG", files: "appointments-step.tsx, from-published-agent.ts" },
  { step: 4, field: "appointmentTypes", section: "Appointments", label: "Appointment types", meaning: "Services/durations", ui: "repeater table", stateKey: "appointmentTypes", persist: "conversationFlow + wizard", amy: "No", astra: "No", runtime: "service.name/duration (first enabled)", provider: "Microsoft", unused: "Partial", dest: "DETERMINISTIC_CONFIG, TOOL/API_DATA", files: "appointments-step.tsx, from-published-agent.ts" },
  { step: 4, field: "bookingBehavior", section: "Appointments", label: "Booking behavior toggles", meaning: "Conversation booking style", ui: "toggles", stateKey: "bookingBehavior.*", persist: "receptionistAdvanced.bookingPolicy + instructions", amy: "No", astra: "No", runtime: "V2 workflow", provider: "No", unused: "V3", dest: "UNKNOWN_REQUIRES_DECISION", files: "appointments-step.tsx, wizard-advanced-bridge.ts" },
  { step: 4, field: "collectFields", section: "Appointments", label: "Fields to collect", meaning: "Intake fields", ui: "repeater", stateKey: "collectFields", persist: "voiceV2Intake + receptionistAdvanced.callerFields", amy: "No", astra: "Yes (catalog + update_intake schema)", runtime: "book_appointment preconditions", provider: "No", unused: "No", dest: "ASTRA_BACKEND_CONTEXT, DETERMINISTIC_CONFIG", files: "appointments-step.tsx, compile-schema.ts, from-published-agent.ts" },
  { step: 4, field: "qualification*", section: "Appointments", label: "Lead qualification", meaning: "Zip/rules gating", ui: "toggles/rules", stateKey: "qualification*", persist: "advanced.qualification", amy: "No", astra: "No", runtime: "V2", provider: "No", unused: "V3", dest: "DETERMINISTIC_CONFIG", files: "appointments-step.tsx" },
  { step: 4, field: "bookingLink/calendly*", section: "Appointments", label: "Link/Calendly", meaning: "Non-Microsoft booking", ui: "inputs", stateKey: "bookingLinkUrl, calendly*", persist: "advanced", amy: "No", astra: "No", runtime: "V2 modes", provider: "Calendly/HTTP", unused: "V3 PSTN Microsoft path", dest: "TOOL/API_DATA", files: "appointments-step.tsx" },
  // Step 5 Call handling
  { step: 5, field: "transfer*", section: "Call Handling", label: "Transfer settings", meaning: "Human transfer", ui: "inputs/toggles", stateKey: "transferDestination*, transferTriggers, warmTransfer", persist: "transfers + receptionistAdvanced.transferPolicy", amy: "Policy mentions transfer (delegation)", astra: "transfer_call tool (destinations often empty in V3 config)", runtime: "transfer_call executor", provider: "Telnyx", unused: "Partial — from-published-agent does not map wizard transfer to VoiceV3AgentConfig.transferDestinations", dest: "DETERMINISTIC_CONFIG, TOOL/API_DATA", files: "call-handling-step.tsx, transfer-call-tool.ts" },
  { step: 5, field: "urgency/callback/sales/aiCallRecovery", section: "Call Handling", label: "After-hours extras", meaning: "Escalation/recovery", ui: "toggles", stateKey: "urgency*, callback*, sales*, aiCallRecovery*", persist: "advanced.voiceV2AfterHoursHandling, voiceV2AiCallRecovery", amy: "No", astra: "No", runtime: "V2/MCTB recovery", provider: "Telnyx/SMS", unused: "V3", dest: "UNKNOWN_REQUIRES_DECISION", files: "call-handling-step.tsx" },
  { step: 5, field: "longTermMemory/crmEnabled", section: "Call Handling", label: "Memory / CRM", meaning: "CRM tools", ui: "toggle", stateKey: "longTermMemory, crmEnabled", persist: "advanced + enabledBuiltinTools", amy: "No", astra: "No", runtime: "V2 CRM tools", provider: "CRM APIs", unused: "V3", dest: "TOOL/API_DATA", files: "call-handling-step.tsx" },
  // Step 6 Voice
  { step: 6, field: "agentName", section: "Voice", label: "Agent name", meaning: "Spoken agent name", ui: "text", stateKey: "agentName", persist: "identity.displayName + dynamicVariables", amy: "Only via VOICE_V3_AGENT_NAME env unless wired", astra: "No", runtime: "greeting.ts uses env defaults", provider: "No", unused: "Wizard value often not on V3 PSTN", dest: "LIVE_FRONTEND_CONTEXT", files: "voice-step.tsx, live-session-config.ts, greeting.ts" },
  { step: 6, field: "role/tone/speakingStyle/language", section: "Voice", label: "Persona", meaning: "Style instructions", ui: "text/select", stateKey: "role, tone, speakingStyle, language", persist: "instructions.* + voiceLanguage", amy: "No V3 (static Live prompt)", astra: "No", runtime: "V2 instructions.system", provider: "Telnyx voice/STT", unused: "V3 persona frozen in live-frontend-instructions.ts", dest: "LIVE_FRONTEND_CONTEXT, UNKNOWN_REQUIRES_DECISION", files: "voice-step.tsx, build-agent-config.ts" },
  { step: 6, field: "openingGreeting/speaksFirst", section: "Voice", label: "Opening greeting", meaning: "First spoken line", ui: "textarea + radio", stateKey: "openingGreeting, speaksFirst", persist: "callHandling.greeting", amy: "Partial — commentary greeting uses env template not wizard text", astra: "No", runtime: "greeting.ts", provider: "No", unused: "Wizard greeting often ignored on V3", dest: "LIVE_FRONTEND_CONTEXT", files: "voice-step.tsx, greeting.ts" },
  { step: 6, field: "conversationBehaviors/guardrails", section: "Voice", label: "Behaviors / guardrails", meaning: "Conversation rules", ui: "toggles + list", stateKey: "conversationBehaviors, guardrails", persist: "instructions + receptionistAdvanced", amy: "No (duplicated statically in Live prompt themes)", astra: "No", runtime: "V2", provider: "No", unused: "V3", dest: "LIVE_FRONTEND_CONTEXT", files: "voice-step.tsx" },
  { step: 6, field: "voiceId/speed/responsiveness/interruption", section: "Voice", label: "Voice settings", meaning: "TTS/STT behavior", ui: "sliders/cards", stateKey: "voiceId, speakingSpeed, responsiveness, interruptionSensitivity", persist: "voiceLanguage + transcription", amy: "voice fixed marin in buildBasicLiveSession", astra: "No", runtime: "No V3", provider: "OpenAI Live audio.output.voice", unused: "Wizard voice picker not applied to V3 accept", dest: "PROVIDER_CONFIG", files: "voice-step.tsx, live-session-config.ts" },
  // Step 7 Test
  { step: 7, field: "testScenario/lastTestPassed", section: "Test", label: "Test scenarios", meaning: "QA checklist", ui: "cards", stateKey: "testScenario, lastTestPassed", persist: "wizard snapshot", amy: "No", astra: "No", runtime: "No", provider: "Telnyx test assistant", unused: "Yes", dest: "UNKNOWN_REQUIRES_DECISION", files: "test-step.tsx" },
  { step: 7, field: "qualityStudioLastRun", section: "Test", label: "Quality studio", meaning: "Publish blockers", ui: "button", stateKey: "qualityStudioLastRun", persist: "wizard", amy: "No", astra: "No", runtime: "No", provider: "No", unused: "Yes", dest: "UNKNOWN_REQUIRES_DECISION", files: "test-step.tsx" },
  // Step 8 Activate
  { step: 8, field: "activationMode/scheduledAt", section: "Activate", label: "Activation", meaning: "Publish timing", ui: "radio + datetime", stateKey: "activationMode, scheduledAt", persist: "VoiceAgent publish + advanced", amy: "No", astra: "No", runtime: "Triggers publish", provider: "No", unused: "N/A", dest: "DETERMINISTIC_CONFIG", files: "activate-step.tsx, route.ts" },
];

const masterTable = wizardFields
  .map(
    (r) =>
      `| ${r.step} | ${r.field} | ${r.meaning} | ${r.persist} | ${r.runtime} | ${r.amy} | ${r.astra} | ${r.runtime} | ${r.provider} | ${r.unused} | ${r.dest} |`,
  )
  .join("\n");

const doc = `# Voice V3 — Prompt, Wizard, and Runtime Mapping Audit

**Status:** Audit only (no production changes).  
**Generated:** ${new Date().toISOString()}  
**Scope:** Production Voice V3 PSTN via \`/api/openai/live/incoming\` → \`sessions.accept\` with GPT-Live-1 + delegated GPT-6 Astra.

---

## Production path proof (Voice V3 PSTN)

| Stage | File | Symbol |
|-------|------|--------|
| HTTP | \`src/app/api/openai/live/incoming/route.ts\` | \`POST\` → \`handleOpenAiLiveIncomingWebhook\` |
| Webhook | \`src/lib/voice-v3-basic/openai-live-webhook.ts\` | \`handleOpenAiLiveIncomingWebhook\` |
| Config resolve | \`src/lib/voice-v3/config/from-published-agent.ts\` | \`resolveVoiceV3AgentConfigForAgent\` (when PSTN leg has workspaceId+agentId) |
| Session build | \`src/lib/voice-v3-basic/live-session-config.ts\` | \`buildBasicLiveSession\` / \`buildBasicLiveSessionAcceptParams\` |
| Amy instructions | \`src/lib/voice-v3/prompts/build-voice-v3-prompts.ts\` | \`buildVoiceV3Prompts\` → \`buildLiveFrontendInstructions\` |
| Astra delegation | \`src/lib/voice-v3/intake/delegation-config.ts\` | \`buildVoiceV3AstraDelegationResponses(astraInstructions, config)\` |
| OpenAI API | \`openai-live-webhook.ts\` | \`client.live.sessions.accept(sessionId, acceptParams)\` |

PSTN correlation: \`consumeRecentPstnLeg()\` in \`src/lib/voice-v3/telemetry/call-trace.ts\` supplies \`workspaceId\` / \`agentId\` for per-agent config.

---

## PART 1 — Production GPT-Live / Amy frontend instructions

### 1.1 Source files and constructors

| # | Item | Location |
|---|------|----------|
| 1 | Prompt source files | \`src/lib/voice-v3/prompts/live-frontend-instructions.ts\`, \`src/lib/voice-v3/prompts/live-delegation-policy.ts\` |
| 2 | Constructor | \`buildLiveFrontendInstructions(context)\` — includes \`buildLiveDelegationPolicySection()\` |
| 3 | Wired into session | \`buildVoiceV3Prompts()\` → \`liveInstructions\` → \`buildBasicLiveSession()\` → \`SessionAcceptParams.Session.instructions\` |
| 4 | Accept call site | \`src/lib/voice-v3-basic/openai-live-webhook.ts\` — \`buildBasicLiveSessionAcceptParams(new Date(), acceptAgentConfig)\` then \`sessions.accept\` |

### 1.2 Dynamic values (Amy)

| Variable | Source | AgentConfig / DB | Default / fallback | Always vs conditional |
|----------|--------|------------------|--------------------|------------------------|
| \`agentName\` | \`buildVoiceV3Prompts({ agentName })\` from \`resolveVoiceV3DefaultPromptInput()\` | **Not** from wizard on V3 path | \`VOICE_V3_AGENT_NAME\` env or \`"Amy"\` | Always interpolated |
| \`businessName\` | \`input.businessName ?? agentConfig.businessName\` | \`resolveVoiceV3AgentConfigForAgent\` → wizard \`businessName\` or \`VoiceAgentConfig.businessName\` or env fallback | \`VOICE_V3_BUSINESS_NAME\` / \`"Transovo"\` in booking fallback | Always |
| Delegation policy | Static \`buildLiveDelegationPolicySection()\` | N/A | N/A | Always appended |

**Important:** \`live-session-config.ts\` spreads \`resolveVoiceV3DefaultPromptInput()\` first, so \`agentName\` on PSTN calls is **environment-driven**, not wizard \`agentName\`, unless future code passes wizard identity into \`buildVoiceV3Prompts\`.

### 1.3 Post-accept Live context (not in main \`instructions\`)

| Mechanism | Files | Purpose |
|-----------|-------|---------|
| \`session.commentary.append\` | \`src/lib/voice-v3/greeting.ts\` | Initial greeting trigger (uses \`resolveVoiceV3InitialGreetingText()\` — env defaults) |
| \`session.thinking.append\` | \`src/lib/voice-v3/agent/sync-agent-state-to-live.ts\` | Authoritative agent snapshot (goals, missing fields, allowed/forbidden claims) |
| \`session.thinking.append\` | \`src/lib/voice-v3/calendar/live-availability-context.ts\` | FIND results / speakable slots |
| \`session.thinking.append\` | \`src/lib/voice-v3/calendar/live-booking-context.ts\`, \`live-management-context.ts\`, \`live-selected-slot-context.ts\` | Booking / reschedule / cancel verified state |
| \`session.thinking.append\` / \`commentary\` | \`src/lib/voice-v3/live/live-context-publisher.ts\` | Central publisher used by tools |
| \`session.thinking.append\` | \`src/lib/voice-v3/recovery/push-recovery-to-live.ts\`, \`live-runtime-hooks.ts\`, \`call-runtime.ts\` | Recovery / hooks |

No \`session.instructions.append\` located under \`src/lib/voice-v3*\`.

### 1.4 Other Amy context (effective business knowledge)

- **Delegation policy** lists capabilities (intake, availability, book, find, reschedule, cancel, transfer, end) — not business-specific facts.
- **Thinking append** carries runtime scheduling/intake truth after tools run.
- **Wizard \`instructions.system\`** (\`compileVoiceAgentPromptFromWizard\`) is saved on publish but **not** loaded into V3 \`sessions.accept\` (Voice V2 / Telnyx path only).

### 1.5 Complete production Amy instructions (template)

Placeholders below match runtime interpolation (\`{{agentName}}\`, \`{{businessName}}\`).

\`\`\`
${amyTemplate}
\`\`\`

---

## PART 2 — Production Astra backend instructions

### 2.1 Source files and constructors

| # | Item | Location |
|---|------|----------|
| 1 | Core | \`src/lib/voice-v3/prompts/astra-backend-core-instructions.ts\` — \`buildAstraBackendCoreInstructions()\` |
| 2 | Assembler | \`src/lib/voice-v3/prompts/astra-backend-instructions.ts\` — \`buildAstraBackendInstructions(context)\` |
| 3 | Intake section | \`src/lib/voice-v3/prompts/astra-intake-instructions.ts\` |
| 4 | Cross-tool section | \`src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts\` |
| 5 | Delegation config | \`src/lib/voice-v3/intake/delegation-config.ts\` — \`instructions: astraInstructions\`, \`model: gpt-6-astra\`, \`tools: buildVoiceV3AstraFunctionTools(config)\` |

### 2.2 Dynamic values (Astra)

| Variable | Source | AgentConfig / DB | Default | Conditional |
|----------|--------|------------------|---------|-------------|
| \`businessName\` | \`buildVoiceV3Prompts\` | \`VoiceV3AgentConfig.businessName\` from published agent | \`"the business"\` in builder | Always |
| \`timezone\` | \`agentConfig.timezone\` | wizard \`timezone\` / config / env fallback | \`America/New_York\` | Always |
| \`currentLocalDateTime\` | \`formatBusinessLocalDateTime(timezone, at)\` at accept | Computed at accept | \`"not yet provided"\` if missing | Always |
| \`intakeFieldCatalog\` | Lines from \`agentConfig.intakeFields\` | \`compileVoiceV2IntakeSchema(loadVoiceAgentRuntimeConfig)\` via \`from-published-agent\` | Fallback \`VOICE_V3_BOOKING_AGENT_CONFIG.intakeFields\` | Always when intake pipeline on |
| \`toolSurface\` | \`resolveVoiceV3DelegationToolSurface()\` | env/feature | \`capability_tools\` vs legacy \`output_text\` | Conditional legacy path |

**Not in Astra text today:** wizard tone, role, guardrails, business hours text, services list prose, FAQs, pricing, transfer names, booking behavior toggles.

### 2.3 Astra instruction layers

1. **Base core** — \`buildAstraBackendCoreInstructions()\` (static)
2. **Business header** — Business name, timezone, local datetime (dynamic)
3. **Intake catalog** — dynamic list of configured fields
4. **Intake rules** — \`buildAstraIntakeInstructions()\` (static)
5. **Cross-tool rules** — \`buildAstraCrossToolInstructions()\` (static) — booking/reschedule/cancel paths, scheduling preference discipline
6. **Per-tool contracts** — OpenAI \`tools[].description\` + Zod parameter schemas (see below)

### 2.4 Complete production Astra instructions (sample assembly)

Example with placeholders for dynamic lines (real call uses resolved values + per-agent intake catalog):

\`\`\`
${astraSample}
\`\`\`

### 2.5 Astra tools registry

${toolRows}

### 2.6 Tool description contracts (\`astra-tool-contracts.ts\`)

${contractBlock}

\`update_intake\` parameter schema is **dynamic** per agent: \`buildUpdateIntakeZodSchema(config)\` in \`src/lib/voice-v3/intake-objective/schema.ts\` (keys = configured intake fields).

\`transfer_call\` destination enum is **dynamic** when \`config.transferDestinations\` is populated (\`buildTransferCallOpenAiTool\`); \`from-published-agent.ts\` does **not** currently map wizard transfer destinations into \`VoiceV3AgentConfig.transferDestinations\`.

---

## PART 3 — Amy vs Astra context comparison

| Information | Amy | Astra | Source | Field / path | How injected | Why today |
|-------------|-----|-------|--------|--------------|--------------|-----------|
| Business name | Yes | Yes | Wizard / VoiceAgentConfig | \`businessName\` | Live \`instructions\`; Astra header line | Greeting + business context |
| Agent name | Yes (env) | No | \`VOICE_V3_AGENT_NAME\` | env | Live \`instructions\` + greeting commentary | Persona |
| Timezone | No | Yes | Wizard / config | \`timezone\` | Astra header | Scheduling normalization |
| Current local datetime | No | Yes | computed at accept | N/A | Astra header | Relative date reasoning |
| Intake field catalog | No | Yes | \`compileVoiceV2IntakeSchema\` | \`collectFields\` → \`voiceV2Intake\` | Astra text + \`update_intake\` schema | Intake capture |
| Intake values (runtime) | Via thinking append | Via tool state | call runtime | \`update_intake\` | thinking append snapshot | Shared truth |
| Availability slots | Via thinking append | Tool results | FIND pipeline | offer sets | thinking append | Amy speaks slots |
| Booking / appt ids | Via thinking append | Tool results | BOOK/MANAGE | provider ids | thinking append | Confirmations |
| Delegation capability list | Yes | No (has tools instead) | static | N/A | Live policy section | When to delegate |
| Cross-tool workflow rules | No | Yes | static | N/A | Astra cross-tool block | Tool discipline |
| Business hours | No | No* | wizard maturity / env fallback | \`operatingMaturity\`, \`businessHours\` in fallback config | FIND uses \`VoiceV3AgentConfig.businessHours\` deterministically, not prompt text | *Not in Astra prose |
| Service name/duration | No | No* | appointment types | \`service\` on VoiceV3AgentConfig | FIND/BOOK executors | *Not in Astra prose |
| Calendar connection | No | No | Prisma | \`voiceCalendarConnection\` | Microsoft adapter | Provider |
| Tone / role / guardrails | No | No | wizard | \`instructions.*\` | V2 system prompt only | Not wired to V3 |
| Business knowledge / FAQs | No | No | KB / Company Brain | \`knowledgeItems\`, KB ids | V2 prompt + retrieval | Not wired to V3 |
| Transfer destinations | Policy only | Tool schema (if configured) | wizard transfers | \`transfers.*\` | V2; V3 tool often loose string | Partial |
| Wizard opening greeting text | Partial | No | wizard | \`openingGreeting\` | commentary greeting (env template) | Misaligned |

### Duplication

- Conversation discipline (brief, one question, don't invent facts) appears in **static Amy prompt** and overlaps thematically with **Astra core** — not wizard-driven.
- **Business name** can appear in Amy instructions, Astra header, and V2 \`instructions.system\` (wizard) simultaneously.

### Neither model today (wizard-only examples)

- \`tone\`, \`speakingStyle\`, \`role\`, \`guardrails\` (wizard → V2 prompt only)
- \`knowledgeItems\`, website-scraped facts, document RAG (V2 + Company Brain)
- \`bookingBehavior.*\` conversation rules (V2 workflow)
- \`connectionGreeting\` audio (Telnyx/V2)
- \`qualificationRules\`, zip gates
- Most \`operatingMaturity\` prose

---

## PART 4 — Wizard inventory (Steps 1–8)

**UI shell:** \`src/components/solutions/appointment-receptionist/wizard.tsx\`  
**Steps:** \`src/lib/solutions/appointment-receptionist/types.ts\` → \`WIZARD_STEPS\`  
**Persistence API:** \`POST /api/solutions/appointment-receptionist\` → \`buildWizardAgentConfig\` + \`updateVoiceAgentDraft\` / publish  
**Wizard snapshot:** \`config.advanced.appointmentReceptionistWizard\` (full \`AppointmentReceptionistWizardState\`)

Detailed per-field rows are consolidated in **PART 8 (Master mapping worksheet)**. Step mapping:

| Step | ID | Primary components |
|------|-----|-------------------|
| 1 | goals | \`steps/goals-step.tsx\` — capabilities, answerWhen, solutionName |
| 2 | phone | \`steps/phone-step.tsx\` — number, ring, recording, connection greeting, outbound SMS |
| 3 | information | \`steps/information-step.tsx\` — business, timezone, knowledge, uploads, operating maturity |
| 4 | appointments | \`steps/appointments-step.tsx\` — booking strategy, calendar, types, collect fields, qualification |
| 5 | call-handling | \`steps/call-handling-step.tsx\` — transfer, fallbacks, recovery, CRM, booking behavior |
| 6 | voice | \`steps/voice-step.tsx\` — persona, greeting, voice picker, sliders |
| 7 | test | \`steps/test-step.tsx\` — scenarios, voice test, quality studio |
| 8 | activate | \`steps/activate-step.tsx\` — activation mode, publish |

**State type reference:** \`AppointmentReceptionistWizardState\` in \`types.ts\` (lines 116–302) lists every persisted wizard field including nested \`bookingBehavior\`, \`collectFields\`, \`appointmentTypes\`, transfer arrays, Calendly/link fields, AI call recovery, operating maturity, etc.

---

## PART 5 — Wizard → Voice V3 runtime traces (proved paths)

### businessName

\`wizard.businessName\` → \`buildWizardAgentConfig\` (\`identity.businessLocation\`, \`dynamicVariables.business_name\`) → published \`VoiceAgentVersion.config\` → \`loadVoiceAgentRuntimeConfig\` → \`resolveVoiceV3AgentConfigForAgent\` → \`VoiceV3AgentConfig.businessName\` → \`buildVoiceV3Prompts\` → **Amy** (\`buildLiveFrontendInstructions\`) + **Astra** header.

### timezone

\`wizard.timezone\` → same publish chain → \`VoiceV3AgentConfig.timezone\` → **Astra** header + \`formatBusinessLocalDateTime\` + scheduling normalizer / FIND windows (deterministic).

### collectFields / intake

\`wizard.collectFields\` → \`mergeAppointmentWizardAdvanced\` → \`advanced.voiceV2Intake\` + \`receptionistAdvanced.callerFields\` → \`compileVoiceV2IntakeSchema(config)\` → \`from-published-agent\` maps to \`intakeFields\` → **Astra** catalog + \`update_intake\` Zod schema + \`operationRequirements\` / book preconditions.

### appointmentTypes (first enabled)

\`wizard.appointmentTypes\` → published config conversationFlow → \`from-published-agent\` picks enabled type → \`VoiceV3AgentConfig.service\` (\`id\`, \`name\`, \`durationMinutes\`) → **find_availability** / **book_appointment** (deterministic), not prompt prose.

### Microsoft calendar

Wizard calendar connect → \`voiceCalendarConnection\` row → \`from-published-agent\` → \`VoiceV3AgentConfig.calendar.connectionId\` → Microsoft FIND/BOOK adapters.

### agentName (wizard)

\`wizard.agentName\` → \`identity.displayName\`, \`dynamicVariables.agent_name\`, V2 \`instructions.system\` → **SAVED BUT NOT CONSUMED BY VOICE V3** Live accept (uses \`VOICE_V3_AGENT_NAME\` unless code change).

### openingGreeting (wizard)

\`wizard.openingGreeting\` → \`callHandling.greeting\` → **SAVED BUT NOT CONSUMED BY VOICE V3** initial commentary (uses \`buildLiveFrontendGreetingLine\` with env/wizard-less defaults).

### knowledgeBase / website / uploads

→ \`advanced.knowledge\`, \`knowledgeBaseIds\`, Company Brain sync → V2 retrieval + \`instructions.system\` Business knowledge → **SAVED BUT NOT CONSUMED BY VOICE V3** PSTN Live path.

### tone, role, guardrails, bookingBehavior

→ \`instructions\` + \`receptionistAdvanced\` → V2 Telnyx → **SAVED BUT NOT CONSUMED BY VOICE V3**.

### transfer destinations

→ \`transfers.*\` in VoiceAgentConfig → V2 \`escalate_human\` → V3 \`transfer_call\` executor exists but \`VoiceV3AgentConfig.transferDestinations\` not populated from wizard in \`from-published-agent.ts\` → **partial / gap**.

---

## PART 6 — File / document / knowledge features

| Feature | Wizard | UI | Types | Upload / API | Storage | Consumer today | V3 PSTN | Index/search |
|---------|--------|-----|-------|--------------|---------|----------------|---------|--------------|
| Website scan | Step 3 | URL + import | website | \`POST /api/voice/knowledge\` action \`scan_website\` | Voice knowledge base + chunks | V2 prompt + retrieval | No | Yes (KB pipeline) |
| Document upload | Step 3 | file input | PDF,DOCX,TXT,MD,CSV | \`POST /api/voice/knowledge/:id/upload\` | KB storage | V2 retrieval tool | No | Yes when enabled |
| Guided profile items | Step 3 | knowledgeItems editor | text fields | wizard state → Company Brain | Company Brain / prompt section | V2 \`instructions.system\` | No | Partial |
| Link existing KB | Step 3 | select | — | \`GET /api/voice/knowledge\` | \`knowledgeBaseIds\` on agent | V2 | No | Yes |
| knowledgeBaseEnabled toggle | Step 3 | toggle | — | advanced.knowledge | feature flag | V2 RAG tool | No | When on |

**No OpenAI Vector Store** is created in this codebase path for V3.

---

## PART 7 — Authoritative configuration source

| Layer | Model | Notes |
|-------|-------|-------|
| Wizard draft | \`AppointmentReceptionistWizardState\` embedded in \`VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard\` | Full UI state |
| Compiled agent config | \`VoiceAgentConfig\` via \`buildWizardAgentConfig\` | Includes \`instructions.system\`, telephony, transfers, KB ids |
| Published | \`VoiceAgentVersion.config\` pointed to by \`VoiceAgent.publishedVersionId\` | What live V2 uses; V3 reads via \`loadVoiceAgentRuntimeConfig\` |
| Voice V3 runtime slice | \`VoiceV3AgentConfig\` via \`resolveVoiceV3AgentConfigForAgent\` | **Subset** — not full wizard |
| Per-call runtime | \`VoiceV3CallRuntime\` context snapshot | Mutable intake/scheduling state during call |

**Draft vs publish:** \`POST /api/solutions/appointment-receptionist\` with \`action: activate\` publishes when checklist passes; \`save_draft\` updates draft only. Scheduled activation stores metadata without demoting ACTIVE agents.

**Incoming call resolution:** PSTN → recent leg context → \`resolveVoiceV3AgentConfigForAgent(workspaceId, agentId)\` **at accept time** (reads **published** config first). This is live published config, not a historical snapshot — intake/catalog can change between calls.

**Accept wiring:** Config loaded in \`openai-live-webhook.ts\` immediately before \`buildBasicLiveSessionAcceptParams\`.

---

## PART 8 — Master mapping worksheet

| Step | Field | Meaning | Persisted At | Current Consumer | Amy Today | Astra Today | Runtime/Tool Today | Provider Today | Currently Unused? | Potential Destination |
|------|-------|---------|--------------|------------------|-----------|-------------|-------------------|----------------|-------------------|----------------------|
${masterTable}

---

## PART 9 — Discrepancy / gap list

### A. Wizard fields useful but reaching neither Amy nor Astra (V3 PSTN)

- Knowledge / website / document RAG / \`knowledgeItems\`
- \`tone\`, \`role\`, \`speakingStyle\`, \`guardrails\`, \`conversationBehaviors\`
- \`bookingBehavior\` toggles
- \`qualification*\` rules
- \`operatingMaturity\` prose (hours policies as text)
- \`connectionGreeting\` / TeXML mask settings
- AI call recovery / urgency / callback toggles

### B. Amy prompt content without wizard source

- Static delegation policy and conversation discipline (by design in \`live-frontend-instructions.ts\`)
- Generic "Amy" persona behaviors not tied to wizard \`tone\` fields

### C. Astra prompt content without wizard source

- Entire \`buildAstraBackendCoreInstructions\` and \`buildAstraCrossToolInstructions\` blocks
- Tool discipline paths (press-1 style ordering) — product-defined, not wizard

### D. Duplicated information

- Business name: wizard → V2 system prompt + V3 Amy + V3 Astra
- "Do not invent availability/pricing" themes: static Amy + static Astra core + wizard guardrails (V2 only)

### E. Wizard fields saved but unused (V3)

See PART 5 traces marked **SAVED BUT NOT CONSUMED BY VOICE V3**.

### F. Runtime configuration not controllable from wizard (V3)

- \`VOICE_V3_*\` env overrides for agent name, fallback intake, business hours in \`VOICE_V3_BOOKING_AGENT_CONFIG\`
- Live voice \`marin\` hardcoded in \`buildBasicLiveSession\`
- \`operationRequirements\` / default intake fields when schema empty

### G. Legacy / V2 still in wizard path

- \`instructions.system\` from \`compileVoiceAgentPromptFromWizard\` (Telnyx / Voice V2)
- \`enabledBuiltinTools\` (calendar_availability, escalate_human, etc.)
- \`voiceV2PstnLiveBooking: false\` in \`wizard-advanced-bridge.ts\` (flag present but false)

### H. Upload / knowledge features not connected to V3

- All KB upload + \`knowledgeBaseEnabled\` paths (PART 6)

### I. UI implies behavior change but V3 may not change

- Changing **agent name**, **opening greeting**, **voice**, **tone** in wizard does not alter V3 \`sessions.accept\` payload today.
- Changing **transfer** settings may not constrain V3 \`transfer_call\` destinations (config mapping gap).
- **Booking strategy** non-Microsoft modes saved but V3 PSTN path assumes Microsoft FIND/BOOK.

---

## Appendix — Static section sources (for diffing)

### Amy delegation policy (also embedded in Amy prompt)

\`\`\`
${buildLiveDelegationPolicySection()}
\`\`\`

### Astra core only

\`\`\`
${buildAstraBackendCoreInstructions()}
\`\`\`

### Astra intake section only

\`\`\`
${buildAstraIntakeInstructions()}
\`\`\`

### Astra cross-tool section only

\`\`\`
${buildAstraCrossToolInstructions()}
\`\`\`

---

*End of audit document.*
`;

const out = join(process.cwd(), "docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md");
writeFileSync(out, doc, "utf8");
console.log("Wrote", out, "bytes", doc.length);
