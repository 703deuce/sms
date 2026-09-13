# Voice Prompt Conformance Audit

**Date:** 2026-09-13  
**Goal:** `CANONICAL_VOICE_BASE_PROMPT_COUNT = 1`  
**New canonical base:** `src/lib/voice/prompt/base-voice-rules.ts` (`TRANSOVO_BASE_VOICE_RULES`)

## Classification key

| Tag | Meaning |
|-----|---------|
| KEEP_BASE_RULE | Universal behavior → base rules module |
| MOVE_TO_BUSINESS_CONTEXT | Workspace facts → wizard-compiled sections |
| MOVE_TO_POLICY_ENGINE | Deterministic policy (not prompt prose) |
| MOVE_TO_RUNTIME | State machine / tool authorization |
| MOVE_TO_TOOL_SCHEMA | Narrow tool descriptions |
| MOVE_TO_RAG | Long-tail knowledge only |
| REMOVE_OBSOLETE | Delete duplicate/legacy |

---

## Legacy sources audited

| Source | Disposition |
|--------|-------------|
| `CALLER_AMY_CONSTITUTION` | **REFACTORED** → delegates to `base-voice-rules` + knowledge hierarchy |
| `CALLER_AMY_DEFAULT_MODULES` / `compilePromptModules` (caller) | **SUPERSEDED** for live caller prompt by `compileVoiceAgentPrompt` |
| `buildSystemPromptLegacy` | **RETAINED** for reference/tests only — not used in publish path |
| `MINIMUM_SIDE_EFFECT_PROMPT` | **KEEP** — appended at Telnyx sync for workflow mode |
| `CONVERSATION_WORKFLOW_PROMPT` | **KEEP** — Telnyx workflow scope guidance |
| `compileCallerToolPlaybookForPrompt` | **KEEP** — tool descriptions at publish (not duplicated in wizard prompt) |
| `buildShortKnowledgeDigest` | **KEEP** — small FAQ text; large docs → RAG |
| `CONVERSATIONAL_PROMPT_GUIDANCE` / `TELNYX_SPEECH_PROMPT_GUIDANCE` | **KEEP** — channel latency/speech |
| `CONDUCTOR_RUNTIME_AUTHORITY` | **MOVE_TO_RUNTIME** — workflow conductor |
| Owner Amy modules (`OWNER_AMY_DEFAULT_MODULES`) | **SEPARATE PRODUCT** — admin agent, not caller |

---

## Instruction migration (caller / after-hours)

| Instruction (paraphrased) | Classification |
|---------------------------|----------------|
| Speak naturally, one question at a time | KEEP_BASE_RULE |
| Never invent business facts | KEEP_BASE_RULE |
| Never claim success before tool confirms | KEEP_BASE_RULE |
| Answer hours/services/pricing from Business knowledge — no tool | KEEP_BASE_RULE + MOVE_TO_BUSINESS_CONTEXT |
| Use retrieval only for uploaded PDFs / not in context | KEEP_BASE_RULE + MOVE_TO_RAG |
| Business name, hours, services, pricing, FAQs | MOVE_TO_BUSINESS_CONTEXT |
| Transfer destination phone in prompt | **REMOVE_OBSOLETE** — semantic only; runtime resolves E.164 |
| Long tool catalog in prompt | MOVE_TO_TOOL_SCHEMA + MOVE_TO_RUNTIME |
| Workflow_state / allowed_tools sequencing | MOVE_TO_RUNTIME |
| Booking confirm before book | MOVE_TO_POLICY_ENGINE + prompt summary |
| distinguishNewExisting | MOVE_TO_BUSINESS_CONTEXT (booking policy section) |
| resolve_datetime / {{business_timezone}} | KEEP in dateTimePolicy section |
| Never offer/book without calendar_availability startsAt | KEEP in booking policy |
| Guardrails array from wizard | KEEP in conversation rules |
| Giant monolithic `buildSystemPromptLegacy` goals list | REMOVE_OBSOLETE as primary path |

---

## Prompt vs RAG vs Runtime (locked)

| Caller question | Path |
|-----------------|------|
| "What time do you close?" | **Prompt** (hours in `knowledgeItems`) |
| "What's your address?" | **Prompt** |
| "Do you repair water heaters?" | **Prompt** (services) |
| "What's the diagnostic fee?" | **Prompt** (pricing) |
| "Do you carry Toto Drake CST776?" | **RAG** (catalog/manual) |
| "Do you have Tuesday at 3?" | **Runtime** (`calendar_availability` → orchestrator) |
| "Did my payment go through?" | **Runtime** (payments provider) |
| "Who is on call tonight?" | **Runtime** (policy + notifications) |

---

## Duplication check

| Check | Result |
|-------|--------|
| `CANONICAL_VOICE_BASE_PROMPT_COUNT` | **1** (`TRANSOVO_BASE_VOICE_RULES`) |
| Customer context from wizard only | **YES** (`compileVoiceAgentPromptFromWizard`) |
| Manual per-customer system prompts | **NO** (wizard compile only) |
| COMMON_BUSINESS_FACTS_REQUIRE_RAG | **NO** (enforced in hierarchy rules) |
| COMMON_BUSINESS_FACTS_REQUIRE_TOOL_CALL | **NO** (enforced in tool policy section) |

---

## Tests

| Script | Validates |
|--------|-----------|
| `scripts/test-voice-prompt-compiler.ts` | Layering, hours/pricing in prompt, no RAG by default |
| `scripts/test-appointment-receptionist-wiring.ts` | Wizard → config → prompt fields |
| `scripts/test-telnyx-speech-path.ts` | Publish path smoke |

---

## Remaining conformance work

1. Wire `inspectCompiledVoicePrompt` to internal admin/debug UI (no customer raw prompt dump).
2. Merge AI Lead Recovery policy summary into `workspacePolicy` section at compile time.
3. Per-turn `callState` overlay injection when Telnyx supports dynamic instruction updates mid-call.
4. PSTN latency tests: assert zero tool calls for prompt-injected FAQ scenarios.
