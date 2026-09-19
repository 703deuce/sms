/**
 * One-off generator for docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md
 * Audit-only — does not modify production runtime.
 */
import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
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

const generatedAt = new Date().toISOString();
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const pathProof = `## Production path proof (Voice V3 PSTN)

| Stage | File | Symbol |
|-------|------|--------|
| HTTP | \`src/app/api/openai/live/incoming/route.ts\` | \`POST\` → \`handleOpenAiLiveIncomingWebhook\` |
| Webhook | \`src/lib/voice-v3-basic/openai-live-webhook.ts\` | \`handleOpenAiLiveIncomingWebhook\` |
| Config resolve | \`src/lib/voice-v3/config/from-published-agent.ts\` | \`resolveVoiceV3AgentConfigForAgent\` |
| Session build | \`src/lib/voice-v3-basic/live-session-config.ts\` | \`buildBasicLiveSession\` |
| Amy instructions | \`src/lib/voice-v3/prompts/build-voice-v3-prompts.ts\` | \`buildLiveFrontendInstructions\` |
| Astra delegation | \`src/lib/voice-v3/intake/delegation-config.ts\` | \`buildVoiceV3AstraDelegationResponses\` |
| OpenAI API | \`openai-live-webhook.ts\` | \`client.live.sessions.accept\` |

PSTN: \`consumeRecentPstnLeg()\` → \`workspaceId\` / \`agentId\` for per-agent config.`;

const part1Meta = `# PART 1 — Production GPT-Live / Amy frontend instructions

**Generated:** ${generatedAt}

### Source files

| Item | Location |
|------|----------|
| Prompt | \`src/lib/voice-v3/prompts/live-frontend-instructions.ts\` |
| Delegation policy | \`src/lib/voice-v3/prompts/live-delegation-policy.ts\` |
| Builder | \`buildLiveFrontendInstructions\` → \`buildVoiceV3Prompts\` → \`buildBasicLiveSession\` |
| Accept | \`openai-live-webhook.ts\` → \`sessions.accept\` |

### Dynamic values (Amy)

| Variable | Source | DB / config | Fallback | Present |
|----------|--------|-------------|----------|---------|
| \`agentName\` | \`resolveVoiceV3DefaultPromptInput()\` | Not wizard on V3 | \`VOICE_V3_AGENT_NAME\` / Amy | Always |
| \`businessName\` | \`agentConfig.businessName\` | wizard / VoiceAgentConfig | env / Transovo | Always |
| Delegation policy | static | — | — | Always |

**Note:** \`agentName\` is env-driven on PSTN, not wizard \`agentName\`.

### Post-accept context (not in \`instructions\`)

| Event | File |
|-------|------|
| \`session.commentary.append\` | \`greeting.ts\` (initial greeting) |
| \`session.thinking.append\` | \`sync-agent-state-to-live.ts\`, \`live-availability-context.ts\`, \`live-booking-context.ts\`, \`live-management-context.ts\`, \`live-context-publisher.ts\`, \`push-recovery-to-live.ts\` |

Wizard \`instructions.system\` is **not** loaded into V3 accept (V2/Telnyx only).

### Complete production Amy instructions

Placeholders: \`{{agentName}}\`, \`{{businessName}}\`. SHA256 prefix: \`${sha(amyTemplate)}\` · ${amyTemplate.length} chars.

\`\`\`
${amyTemplate}
\`\`\`
`;

const part2Meta = `# PART 2 — Production Astra backend instructions

**Generated:** ${generatedAt}

### Source files

| Layer | File |
|-------|------|
| Core | \`astra-backend-core-instructions.ts\` |
| Assembler | \`astra-backend-instructions.ts\` |
| Intake rules | \`astra-intake-instructions.ts\` |
| Cross-tool | \`astra-cross-tool-instructions.ts\` |
| Delegation | \`delegation-config.ts\` (model \`gpt-6-astra\`, tools from catalog) |

### Dynamic values (Astra)

| Variable | Source | Fallback |
|----------|--------|----------|
| \`businessName\` | \`VoiceV3AgentConfig\` | the business |
| \`timezone\` | wizard / config | America/New_York |
| \`currentLocalDateTime\` | computed at accept | not yet provided |
| \`intakeFieldCatalog\` | \`compileVoiceV2IntakeSchema\` | booking fallback fields |

**Not in Astra text:** wizard tone, role, guardrails, hours prose, FAQs, pricing, transfer names.

### Astra tools registry

${toolRows}

### Complete assembled Astra instructions (sample)

Placeholders: \`{{businessName}}\`, \`{{timezone}}\`, \`{{currentLocalDateTime}}\`, \`{{intakeFieldCatalog}}\`. SHA256 prefix: \`${sha(astraSample)}\` · ${astraSample.length} chars.

\`\`\`
${astraSample}
\`\`\`

### Tool description contracts (\`astra-tool-contracts.ts\`)

${contractBlock}

\`update_intake\` schema: dynamic per agent (\`buildUpdateIntakeZodSchema\`). \`transfer_call\`: enum only if \`config.transferDestinations\` set — wizard transfer **not** mapped in \`from-published-agent.ts\` today.

### Static sections (also embedded above)

<details><summary>Astra core only (expand)</summary>

\`\`\`
${buildAstraBackendCoreInstructions()}
\`\`\`

</details>
`;

const part3to7 = `# PARTS 3–7 — Compare, wizard, traces, knowledge, config

**Generated:** ${generatedAt}

${pathProof}

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

Shell: \`wizard.tsx\` · State: \`AppointmentReceptionistWizardState\` (\`types.ts\` L116–302)  
Save: \`POST /api/solutions/appointment-receptionist\` → \`buildWizardAgentConfig\` · Snapshot: \`advanced.appointmentReceptionistWizard\`

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

Per-field worksheet: **PART 8** in \`04-worksheet-and-gaps.md\`.

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
| Wizard draft | \`draftConfig.advanced.appointmentReceptionistWizard\` |
| Compiled | \`VoiceAgentConfig\` via \`buildWizardAgentConfig\` |
| Published | \`VoiceAgentVersion.config\` (\`publishedVersionId\`) |
| V3 slice | \`VoiceV3AgentConfig\` via \`resolveVoiceV3AgentConfigForAgent\` |
| Per-call | \`VoiceV3CallRuntime\` snapshot |

Accept reads **published** config at call time (not immutable snapshot). Loaded in \`openai-live-webhook.ts\` before \`buildBasicLiveSessionAcceptParams\`.
`;

const part8to9 = `# PARTS 8–9 — Worksheet and gaps

**Generated:** ${generatedAt}

## PART 8 — Master mapping worksheet

| Step | Field | Meaning | Persisted At | Consumer | Amy | Astra | Runtime | Provider | Unused? | Potential Destination |
|------|-------|---------|--------------|----------|-----|-------|---------|----------|---------|----------------------|
${masterTable}

---

## PART 9 — Discrepancy list

**A.** Useful wizard fields → neither Amy nor Astra (V3): knowledge/RAG, tone/role/guardrails, bookingBehavior, qualification, operatingMaturity, connectionGreeting, recovery toggles.

**B.** Amy without wizard source: static delegation policy + conversation discipline in \`live-frontend-instructions.ts\`.

**C.** Astra without wizard source: core + cross-tool blocks; tool path ordering.

**D.** Duplicated: business name; “don’t invent” themes (Amy + Astra + V2 guardrails).

**E.** Saved unused V3: see PART 5 **SAVED NOT CONSUMED**.

**F.** Runtime not from wizard: \`VOICE_V3_*\` env, voice \`marin\`, default intake when schema empty.

**G.** Legacy: \`instructions.system\`, \`enabledBuiltinTools\`, \`voiceV2PstnLiveBooking: false\`.

**H.** Upload/knowledge not on V3 PSTN.

**I.** UI mismatch: agentName, greeting, voice, tone, transfer, non-Microsoft bookingStrategy may not change V3 accept behavior.
`;

const auditDir = join(process.cwd(), "docs/voice-v3-prompt-wizard-audit");
mkdirSync(auditDir, { recursive: true });

const files: Record<string, string> = {
  "01-amy-production-prompt.md": part1Meta,
  "02-astra-production-prompt.md": part2Meta,
  "03-compare-wizard-traces-config-knowledge.md": part3to7,
  "04-worksheet-and-gaps.md": part8to9,
};

for (const [name, body] of Object.entries(files)) {
  const p = join(auditDir, name);
  writeFileSync(p, body, "utf8");
}

const indexDoc = `# Voice V3 — Prompt / Wizard / Runtime audit (index)

**Status:** Audit only · **Generated:** ${generatedAt}

The full report was split into smaller files so each part downloads reliably. **All content from the original single file is preserved** (appendix duplicates removed — static Astra core is in part 2).

## Download options

| File | Contents | ~Size |
|------|----------|-------|
| [01-amy-production-prompt.md](./voice-v3-prompt-wizard-audit/01-amy-production-prompt.md) | PART 1 — full Amy/Live instructions + metadata | ${part1Meta.length} B |
| [02-astra-production-prompt.md](./voice-v3-prompt-wizard-audit/02-astra-production-prompt.md) | PART 2 — full Astra instructions + tool contracts | ${part2Meta.length} B |
| [03-compare-wizard-traces-config-knowledge.md](./voice-v3-prompt-wizard-audit/03-compare-wizard-traces-config-knowledge.md) | PARTS 3–7 | ${part3to7.length} B |
| [04-worksheet-and-gaps.md](./voice-v3-prompt-wizard-audit/04-worksheet-and-gaps.md) | PARTS 8–9 | ${part8to9.length} B |
| [VOICE-V3-AUDIT.zip](./voice-v3-prompt-wizard-audit/VOICE-V3-AUDIT.zip) | All four parts in one zip | — |
| [VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT-CONDENSED.md](./VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT-CONDENSED.md) | Worksheet + gaps + path proof **without** full prompt bodies | small |

## Regenerate

\`npx tsx scripts/generate-voice-v3-prompt-wizard-audit-doc.ts\`

## Quick findings

- V3 Amy = \`live-frontend-instructions.ts\` (not wizard \`instructions.system\`).
- Wizard → V3 subset: businessName, timezone, intake schema, first appointment type, Microsoft calendar.
- Knowledge/RAG/Company Brain: saved, **not** on V3 PSTN accept.
- Wizard \`agentName\` / \`openingGreeting\`: often **not** on V3 accept (env greeting path).

---

${pathProof}
`;

const condensedDoc = `# Voice V3 audit — condensed (no full prompt bodies)

**Generated:** ${generatedAt}  
Use **split files** or zip for full Amy/Astra prompt text. This file has path proof, comparison, wizard, traces, worksheet, and gaps only.

---

${pathProof}

---

${part3to7.split("---").slice(1).join("---")}

---

${part8to9}
`;

writeFileSync(join(process.cwd(), "docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md"), indexDoc, "utf8");
writeFileSync(
  join(process.cwd(), "docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT-CONDENSED.md"),
  condensedDoc,
  "utf8",
);

try {
  execSync(
    `cd "${auditDir}" && zip -q VOICE-V3-AUDIT.zip 01-amy-production-prompt.md 02-astra-production-prompt.md 03-compare-wizard-traces-config-knowledge.md 04-worksheet-and-gaps.md`,
  );
} catch {
  // zip optional
}

console.log("Wrote index + split parts under docs/voice-v3-prompt-wizard-audit/");
for (const [name, body] of Object.entries(files)) {
  console.log(" ", name, body.length, "bytes");
}
console.log(" condensed:", condensedDoc.length, "bytes");
console.log(" index:", indexDoc.length, "bytes");
