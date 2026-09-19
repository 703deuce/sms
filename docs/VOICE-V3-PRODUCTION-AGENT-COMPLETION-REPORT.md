# Voice V3 — Production Agent Completion Pass (living report)

This document tracks the urgent production-agent pass. **No production `next build` required for agent work** — run locally before deploy.

## Architecture (healthy path)

```
CALLER ↔ GPT-Live (Amy) → Responses delegation → GPT-6 Astra
  → direct function tool → executeVoiceTool / VoiceToolRegistry
  → Microsoft / Telnyx → structured tool result → Astra → GPT-Live ↔ CALLER
```

## Live delegation contract

Canonical section: `src/lib/voice-v3/prompts/live-delegation-policy.ts`, embedded in `buildLiveFrontendInstructions()`.

Amy receives **capabilities + delegate when / do not delegate when** — not Astra JSON schemas.

## Astra backend prompt

- Core: `src/lib/voice-v3/prompts/astra-backend-core-instructions.ts`
- Cross-tool paths: `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`
- Assembler: `buildAstraBackendInstructions()`

## Tool registry (8 tools)

Single catalog: `src/lib/voice-v3/tools/voice-tool-catalog.ts`

| Tool | Kind | OpenAI builder | Executor |
|------|------|----------------|----------|
| update_intake | state_update | update-intake-tool | merge-intake-state |
| find_availability | read | find-availability-tool | find-dispatch |
| book_appointment | mutation | book-appointment-tool | book-dispatch |
| find_appointment | read | find-appointment-tool | find-existing-appointment |
| reschedule_appointment | mutation | reschedule-appointment-tool | reschedule-dispatch |
| cancel_appointment | mutation | cancel-appointment-tool | cancel-dispatch |
| transfer_call | lifecycle | transfer-call-tool | transfer env mapping |
| end_call | lifecycle | end-call-tool | lifecycle log |

Descriptions: `src/lib/voice-v3/tools/astra-tool-contracts.ts`

Strict schemas: audited by `scripts/test-voice-v3-astra-tool-contracts-audit.ts`

## Result contract

`VoiceToolResult` in `src/lib/voice-v3/tools/types.ts` with `retryable` on errors.

Standard codes: `src/lib/voice-v3/tools/tool-result-codes.ts`

## Concurrency

- `parallel_tool_calls` default **false** on Live delegation (`voiceV3DelegationParallelToolCallsEnabled()` — set `VOICE_V3_PARALLEL_TOOL_CALLS=1` only when batch barrier is certified).
- Matrix helpers: `src/lib/voice-v3/tools/concurrency-policy.ts`

## Confirmations

`src/lib/voice-v3/agent/confirmation-policy.ts` — cancel requires `confirmed=true` in executor.

## Context injection

`src/lib/voice-v3/live/live-context-publisher.ts` — thinking vs commentary.

Astra business projection: `src/lib/voice-v3/agent/astra-business-context.ts`

## Stale scheduling reads

`VOICE_TOOL_STALE_RESULT_IGNORED` logged from `find-dispatch` when generation mismatches.

## Version telemetry

`logVoiceV3ContractVersions()` on runtime create — `src/lib/voice-v3/telemetry/contract-versions.ts`

## Certification scripts (no full build)

| Script | Layer |
|--------|--------|
| test-voice-v3-architecture-invariants.ts | Phase 18 static |
| test-voice-v3-tool-safety-layer.ts | Phase 19D deterministic |
| test-voice-v3-astra-tool-contracts-audit.ts | Strict schemas + descriptions |
| test-voice-v3-astra-tool-selection.ts | Phase 19B live Astra (OPENAI_API_KEY) |
| test-voice-v3-delegation-protocol-* | Phase 20 protocol |

## PSTN (Phase 21)

After merge + deploy + SOURCE_COMMIT verification — manual 571 script per owner runbook.
