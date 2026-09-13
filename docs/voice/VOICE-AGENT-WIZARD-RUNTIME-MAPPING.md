# Voice Agent Wizard → Runtime Mapping

**Status:** Phase 1 audit + Phase 2 prompt compiler (v1.0.0)  
**Canonical compiler:** `src/lib/voice/prompt/compile-voice-agent-prompt.ts`  
**WIZARD_NO_OP_FIELDS:** 0 (target — every field below has a documented downstream effect)

## End-to-end data flow

```
Wizard UI (8 steps)
  → POST /api/solutions/appointment-receptionist
  → buildWizardAgentConfig(state)
      → compileVoiceAgentPromptFromWizard(state)  → instructions.system
      → enabledBuiltinTools, transfers, voice, STT/TTS, dynamicVariables
      → advanced.appointmentReceptionistWizard (full snapshot)
  → VoiceAgent.draftConfig + SolutionSetup.configJson.wizard
  → activate: publishVoiceAgent → recompileReceptionistFromDraft → syncTelnyxAssistant
  → Inbound PSTN/WebRTC → Telnyx AI Assistant (instructions + tools + RAG buckets)
  → POST /api/telnyx/voice/tools → executeBuiltinVoiceAction (runtime authorization)
```

**Mental model:** Prompt knows the business. RAG knows the library. Runtime knows what is allowed. Providers know what is currently true.

---

## Step 1 — Purpose (Goals)

| Field / control | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-----------------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `capabilities[]` | `draftConfig`, `appointmentReceptionistWizard` | Allowed capabilities section | Capability gating | `enabledBuiltinTools` pre-apply; workflow tool surface | Catalog in `voice/tools/catalog.ts` | `buildAssistantTools` | — | Which actions exist | `test-appointment-receptionist-wiring.ts` |
| `answerWhen` | wizard snapshot | Workspace policy + call handling | Routing mode | `syncWizardRoutingRules` | — | Inbound routing | — | When AI answers | routing tests |
| `ringBehavior` | wizard snapshot | Call handling | Routing | `resolveWizardRoutingMode` | — | TeXML / routing | — | Ring vs immediate AI | routing tests |
| `solutionName` / `agentName` | VoiceAgent.name, identity | Identity section | — | Display | — | Assistant name | — | Dashboard label | wiring |
| `preset` | wizard snapshot | Profile (`after_hours` vs `appointment_receptionist`) | — | Outcome slug | — | — | — | Agent type | presets tests |

## Step 2 — Phone

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `phoneNumberId` / `phoneNumberE164` | wizard + PhoneNumber row | Business information (phone) | Activation checklist | DID assignment on activate | — | Number on assistant | — | Inbound target | activation checklist |
| `numberSource` | wizard | — | — | Provision flow | — | — | — | How number acquired | manual |
| `callRecording` | wizard | — | Recording disclosure warning | Recording flags | — | Recording config | — | Compliance | activate step |
| `connectionGreeting*` | wizard | — | — | `startupGreeting` in config | — | Greeting audio/TTS | — | First audio | wiring (tts mode) |

## Step 3 — Business Knowledge (Information)

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `knowledgeItems[]` (business, hours, services, pricing, faqs, policies) | wizard + Company Brain sync | **PROMPT_CONTEXT** sections | — | — | `search_business_details` only if not in prompt | Short digest in `assistant-sync` | — | Fast FAQ answers | `test-voice-prompt-compiler.ts` |
| `websiteUrl` + scan | wizard + KB sources | Business information line | — | Website import job | — | RAG index if large | **RAG_CONTEXT** | Long-tail site content | knowledge tests |
| `linkedKnowledgeBaseId` | wizard | — | — | KB link | retrieval tool | Telnyx buckets | **RAG_CONTEXT** | Document Q&A | knowledge-processor |
| Upload docs | VoiceKnowledgeSource | — | — | `processKnowledgeSource` | retrieval | Telnyx RAG | **RAG_CONTEXT** | Manuals/catalogs | — |
| `businessName` | wizard + brain | Identity + business context | Activation | dynamicVariables | — | — | — | Spoken name | wiring |

**Classification:** `src/lib/voice/prompt/knowledge-classification.ts`

## Step 4 — Booking (Appointments)

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `calendarProvider` / `calendarConnected` | wizard | Booking policy + call handling | LR booking policy (future merge) | Microsoft/Calendly adapters | `calendar_*`, `book_*` when workflow permits | Workflow nodes | — | Live availability | booking conformance |
| `appointmentTypes[]` | wizard + services sync | Booking targets in call handling | — | Scheduling specialist | book_appointment args | — | — | What can be booked | wiring |
| `bookingBehavior.*` | wizard | Booking policy section | Confirm-before-book | Workflow guards | — | — | — | Conversation rules | wiring |

## Step 5 — Call Handling

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `transferTriggers[]` | wizard | Transfer policy | — | Transfer policy engine | `escalate_human` / `transfer` | Transfer node | — | When to hand off | transfer tests |
| `transferDestinationPhone` | wizard + TransferDestination row | Semantic only (no number in prompt) | Activation | **Runtime resolves E.164** | transfer targets in config | Native transfer | — | Human handoff | transfer tests |
| `transferFallback` | wizard | Fallback policy | — | Fallback state machine | take_message | Recovery node | — | Failed transfer | — |
| `bookingBehavior` (conversation) | wizard | Booking + tool policy | LR policy | Workflow engine | gated tools | — | — | Booking UX | wiring |
| `longTermMemory` / `crmEnabled` | wizard | — | — | Memory + CRM tools post-call | CRM tools | — | — | CRM writes | — |

## Step 6 — Voice

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `voiceId` / `voiceLabel` | wizard | Conversation rules (tone) | — | TTS voice | — | `assistant-sync` voice settings | — | Spoken voice | telnyx speech tests |
| `tone`, `speakingStyle`, `language` | wizard | Conversation rules | — | STT language | — | Transcription + TTS | — | Style | — |
| `openingGreeting`, `speaksFirst` | wizard | — | — | Greeting interpolation | — | First speaker | — | Opening | — |
| `conversationBehaviors` | wizard | Conversation rules + safety | — | — | — | — | — | Brief/confirm | compiler test |
| `guardrails[]` | wizard | Safety section | — | Tool policy | — | — | — | Hard limits | — |

## Step 7 — Test

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `lastTestPassed` | wizard | — | Activation warning | — | — | TESTING version | — | Go-live gate | activate step |
| `testScenario` | wizard | — | — | Test harness | build_for_test | test-session API | — | QA | e2e scripts |

## Step 8 — Activate

| Field | Persisted | Prompt | Policy | Runtime | Tools | Telnyx | RAG | Live effect | Tests |
|-------|-----------|--------|--------|---------|-------|--------|-----|-------------|-------|
| `activationMode` | wizard | — | Publish vs draft | `publishVoiceAgent` | Full publish | Live assistant | Re-index if needed | Go live | wizard e2e |
| `scheduledAt` | wizard.advanced | — | Schedule promote | `promoteScheduledAgents` | — | — | — | Delayed activation | — |

---

## Knowledge routing summary

| Type | Examples | Route |
|------|----------|-------|
| Fast facts | Hours, address, services, diagnostic fee, top FAQs | **PROMPT_CONTEXT** (`buildCompactBusinessSections`) |
| Long-tail | 500 SKUs, manuals, large uploads | **RAG_CONTEXT** (Telnyx retrieval + `searchKnowledge`) |
| Live truth | Availability, payment status, on-call | **RUNTIME_AUTHORITATIVE** (tools/providers only) |

---

## Version metadata (per compile)

Recorded in `CompiledVoicePromptResult.metadata`:

- `compilerVersion` — `v1.0.0`
- `baseRulesVersion` — `v1.0.0`
- `businessContextRevision` — hash of approved knowledge + caps
- `includedSectionIds` — which prompt sections were emitted

Telnyx publish should continue recording assistant revision via `VoiceAgentVersion` (existing).

---

## Phase roadmap (remaining)

| Phase | Status |
|-------|--------|
| 1 Audit + mapping | **This document** |
| 2 Prompt compiler | **Shipped** (`compileVoiceAgentPrompt`) |
| 3 Structured call state | Existing `workflow-runtime/canonical-state.ts` — wire to prompt overlays |
| 4 Intent/policy LR merge | `evaluateLeadRecoveryPolicy` → voice pre-tool gate (not yet wired) |
| 5 Tool gating | `workflow-engine/tool-publish.ts`, `tool-policy/registry.ts` — extend per-turn |
| 6 Tool results | `tool-policy/structured-result.ts` — normalize all builtins |
| 7 Observability | `workflow-engine/trace.ts` — expand CALL_* events |
| 8 PSTN regression | `scripts/test-voice-prompt-compiler.ts` + manual PSTN |
