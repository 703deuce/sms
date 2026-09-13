# Telnyx Voice Agent Build Contract

**Platform:** Telnyx AI Assistant (production). Not LiveKit.  
**Brain control layer:** Transovo runtime (policy, tools, state, idempotency).

## Current paths (do not duplicate)

| Concern | Canonical file | Key functions |
|---------|----------------|---------------|
| Wizard → config | `src/lib/solutions/appointment-receptionist/build-agent-config.ts` | `buildWizardAgentConfig`, `buildSystemPrompt` |
| Prompt compile | `src/lib/voice/prompt/compile-voice-agent-prompt.ts` | `compileVoiceAgentPrompt`, `compileVoiceAgentPromptFromWizard` |
| Draft/publish | `src/lib/voice/agent-service.ts` | `updateVoiceAgentDraft`, `publishVoiceAgent`, `buildVoiceAgentForTest` |
| Telnyx sync | `src/lib/voice/telnyx/assistant-sync.ts` | `syncTelnyxAssistant` |
| Telnyx API | `src/lib/voice/telnyx/ai-client.ts` | `createAssistant`, `updateAssistant` |
| Tools on assistant | `src/lib/voice/telnyx/assistant-tools.ts` | `buildAssistantTools` |
| Tool callbacks | `src/app/api/telnyx/voice/tools/route.ts` | Webhook ingress |
| Tool execution | `src/lib/voice/tools/builtin-actions.ts` | `executeBuiltinVoiceAction` |
| Runtime config load | `src/lib/voice/load-agent-config.ts` | `loadVoiceAgentRuntimeConfig` |
| Wizard API | `src/app/api/solutions/appointment-receptionist/route.ts` | GET/POST save/activate |
| Test agent | `src/lib/voice/agent-service.ts` | `buildVoiceAgentForTest` |
| Browser test | `src/lib/voice/platform/test-session.ts` | `createVoiceTestSession` |

## CURRENT_TEST_AGENT_PATH

1. Wizard **Test** step → `ensureAgentForTest()` → `POST appointment-receptionist` save_draft  
2. `PATCH /api/voice/agents/:id` `{ action: "build_for_test" }`  
3. `buildVoiceAgentForTest` → `recompileReceptionistFromDraft` → `syncTelnyxAssistant`  
4. `POST /api/voice/agents/:id/test-session` → WebRTC to `telnyxAssistantId`

## CURRENT_PROMPT_PATH

```
Wizard state
  → compileVoiceAgentPromptFromWizard (layered sections)
  → VoiceAgentConfig.instructions.system
  → syncTelnyxAssistant merges:
      - instructions.system
      - MINIMUM_SIDE_EFFECT_PROMPT / CONVERSATION_WORKFLOW_PROMPT (when enabled)
      - compileCallerToolPlaybookForPrompt (when applicable)
      - buildShortKnowledgeDigest (FAQ text sources)
      - latency/speech guidance
  → Telnyx assistant.instructions (published)
```

## CURRENT_TOOL_PATH

```
Telnyx model requests tool
  → POST /api/telnyx/voice/tools
  → recordToolWebhookIngress
  → resolve call + workspace + agent from assistant/session
  → executeBuiltinVoiceAction / executeVoiceTool
  → structured result → model
```

Published tool **surface** for minimum-side-effect workflow mode is intentionally narrow:

`hangup`, `transfer`, `send_resource`, `search_business_details`  
(see `applyAmyMinimumSideEffectConfig` in `amy-minimum-side-effect.ts`)

Calendar/booking tools remain in runtime for workflow nodes and non-minimum-side-effect profiles.

## CURRENT_BUILD_PATH (activate)

```
POST /api/solutions/appointment-receptionist { action: "activate" }
  → buildWizardAgentConfig
  → updateVoiceAgentDraft
  → runAppointmentReceptionistActivateHooks (KB, services, routing, transfer)
  → upsertAppointmentReceptionistSetup
  → activateFlowTriggers → publishVoiceAgent
  → VoiceAgentVersion (published config)
  → syncTelnyxAssistant (model, STT, TTS, voice, tools, instructions)
  → phone/DID routing publish
```

## Storage

| Artifact | Location |
|----------|----------|
| Assistant ID | `VoiceAgent.telnyxAssistantId` |
| Draft config | `VoiceAgent.draftConfig` JSON |
| Published config | `VoiceAgentVersion.config` |
| Wizard snapshot | `draftConfig.advanced.appointmentReceptionistWizard` + `SolutionSetup.configJson.wizard` |
| RAG buckets | Telnyx + `VoiceKnowledgeSource` / `getAgentRagBucketIds` |

## What Telnyx hosts vs Transovo owns

| Telnyx hosts | Transovo owns |
|--------------|---------------|
| Audio, STT, LLM, TTS transport | Workspace policy |
| Tool invocation webhook transport | Tool authorization + implementation |
| Call lifecycle | Structured call state |
| Assistant config blob | Idempotency, provider adapters |
| RAG bucket hosting | Business configuration source (wizard) |
| | Observability / traces |

## Rebuild triggers (when wizard changes)

| Change type | Action |
|-------------|--------|
| Business knowledge (hours, services, FAQ) | Recompile prompt → `syncTelnyxAssistant` |
| Voice / STT / TTS | `syncTelnyxAssistant` voice + transcription blocks |
| Capabilities / transfer | Prompt + tools + routing sync |
| Large document upload | RAG re-index (`processKnowledgeSource`) + optional prompt digest |
| Phone number | Routing publish (may not need full assistant rebuild) |

## Active call immutability (recommended)

- Capture `businessContextRevision` + `compilerVersion` at call start.
- Mid-call wizard edits apply to **new calls only**.
- Urgent compliance overrides may force prompt refresh (explicit product decision).

## Authorization contract (tool webhook)

Every invocation must resolve:

`assistantId` → `callId` → `workspaceId` → `VoiceAgent` → `loadVoiceAgentRuntimeConfig` → policy version

Never trust model-supplied: workspace ID, phone numbers, calendar IDs, payment amounts, transfer destinations.
