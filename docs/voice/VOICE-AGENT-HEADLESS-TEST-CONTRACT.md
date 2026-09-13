# Voice agent headless test contract

## Purpose

Debug voice tool calling without PSTN, STT, or TTS. Inject **caller text** at the same layer the conversational model consumes after transcription, while keeping Transovo runtime, policy, tool webhooks, and action dispatch on the production path.

## Production flow (voice call)

```
Caller audio
  → Telnyx assistant (STT)
  → user text turn
  → Telnyx conversation workflow + LLM
  → tool request (send_resource, …)
  → POST /api/telnyx/voice/tools  (Transovo)
  → policy / capability / guard
  → executeBuiltinVoiceAction → executeSendResource
  → sendQuickSms (Telnyx messaging)
  → tool JSON back to Telnyx
  → assistant spoken response (TTS)
```

## Headless flow (certification)

```
TEST STRING (caller text)
  → OpenAI chat with PRODUCTION_PROMPT_COMPILER output + CANONICAL_TOOL_SCHEMAS
  → model tool call (same names/args as Telnyx webhooks)
  → invokeToolWebhook → POST /api/telnyx/voice/tools (in-process Request)
  → same guards + executeSendResource
  → sendQuickSms → RecordingSmsAdapter (HEADLESS_PROVIDER_MODE=recording)
  → tool JSON back to model
  → assistant text (no TTS)
```

**Equality target:** `HEADLESS_RUNTIME_PATH` uses the same tool webhook route and `send_resource` implementation as production. The LLM host differs (OpenAI API vs Telnyx-hosted model) but prompt and tool schemas are shared.

## Anchors (do not duplicate)

| Role | Module |
|------|--------|
| `PRODUCTION_TEXT_ENTRY_POINT` (voice) | Telnyx STT → conversation workflow user message |
| `PRODUCTION_TEXT_ENTRY_POINT` (headless) | `openAiChatWithTools` user role messages |
| `PRODUCTION_PROMPT_COMPILER` | `compileVoiceAgentPromptFromWizard` |
| `PRODUCTION_TOOL_REGISTRY` | `BUILTIN_WEBHOOK_BODIES` / `catalog.ts` |
| `PRODUCTION_POLICY_ENGINE` | `filterPublishedToolsForRuntime`, `assertToolAllowed`, LR policy bridge |
| `PRODUCTION_ACTION_RUNTIME` | `executeBuiltinVoiceAction` / `executeSendResource` |
| `PRODUCTION_TOOL_CALLBACK_HANDLER` | `src/app/api/telnyx/voice/tools/route.ts` |
| `PRODUCTION_CONVERSATION_STATE` | Telnyx workflow graph + `VoiceAfterHoursCallState` on `VoiceCall.metadata` |

## Test levels

### Level A — `test:voice:runtime`

Deterministic. Calls `invokeToolWebhook` directly. No LLM. Validates authorization, SMS recording adapter, schema conformance.

### Level B — `test:voice:headless`

Real configured LLM (`OPENAI_API_KEY` / `DEEPSEEK_API_KEY`). Multi-turn scenarios (e.g. FAQ then booking link). Asserts tool choice, webhook success, SMS count — not exact prose.

## Fixture

**Woodbridge Plumbing Test** — `seedWoodbridgeHeadlessFixture()` in `src/lib/voice/testing/headless/woodbridge-fixture.ts`.

After-hours, booking link mode, diagnostic $89, services in prompt context.

## Side effects

| Mode | SMS |
|------|-----|
| `HEADLESS_PROVIDER_MODE=recording` (default in harness) | `RecordingSmsAdapter` via `sendQuickSms` hook |
| `HEADLESS_PROVIDER_MODE=live` | Real provider (explicit opt-in; not default in CI) |

## Commands

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:voice:runtime
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:voice:headless
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:voice:scenario -- booking-link-two-turn
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run voice:headless
```

## Development loop

1. Change runtime / prompt / tool code  
2. `npm run test:voice:scenario -- booking-link-two-turn`  
3. `npm run test:voice:runtime`  
4. Republish Telnyx assistant only when schema/prompt publish changes  
5. One PSTN smoke call for STT/TTS/transport  

## Current SMS bug stop condition

Headless Level A + Level B `booking-link-two-turn` must show:

`send_resource` → webhook `ok` → exactly one recorded SMS → assistant does not claim sent before tool success.
