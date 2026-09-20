# Voice V3 GPT-Live delegation observability (diagnostic only)

Observability-only deployment to classify the **first failed boundary** (cases A–F) on the next PSTN call. No prompt, tool schema, intake, or orchestration changes.

## Deploy

1. Merge/push branch with `voice-runtime-python/transovo_voice/voice_v3/gpt_live_observability.py` wiring.
2. **Redeploy the Coolify voice worker** (manual; web auto-deploy does not restart the worker). Use full git SHA in the deploy queue.

## Log events (stdout JSON)

| Event | Meaning |
|-------|---------|
| `voice_v3_delegation_expected` | AgentSession tool count/names before start (not wire proof) |
| `VOICE_V3_GPT_LIVE_SESSION_START_DELEGATION` | Actual `session.start` delegation payload (tool count/names, models) |
| `voice_v3_gpt_live_delegation_created` | Raw `session.delegation.created` |
| `voice_v3_gpt_live_response_event` | Nested `response.event` type |
| `VOICE_V3_ASTRA_RESPONSE_STARTED` | Nested `response.created` |
| `VOICE_V3_ASTRA_FUNCTION_CALL_REQUESTED` | Nested `response.output_item.done` function_call |
| `voice_v3_livekit_function_call_emitted` | LiveKit `function_call` on GPTLiveSession |
| `VOICE_V3_LIVEKIT_FUNCTION_TOOL_STARTED` / `_COMPLETED` / `_FAILED` | Python FunctionTool adapter |
| `voice_v3_llm_metrics_collected` | Backend Responses usage when `response.completed` fires |

## Diagnostic call script (caller)

Use a request that clearly requires backend work under Amy’s delegation policy, for example:

- Supply configured intake facts (name, email).
- Ask for real availability for a specific day/duration.

Avoid small talk.

## Post-call report template

Fill from voice worker logs (filter by `callId` / `room`):

1. Caller final transcript timestamp — `voice_v3_caller_utterance_committed`
2. `session.delegation.created`? — `voice_v3_gpt_live_delegation_created`
3. `response.created`? — `VOICE_V3_ASTRA_RESPONSE_STARTED`
4. Delegated tool count/names — `VOICE_V3_GPT_LIVE_SESSION_START_DELEGATION` and/or compare to `voice_v3_delegation_expected`
5. `VOICE_V3_ASTRA_FUNCTION_CALL_REQUESTED`?
6. `VOICE_V3_LIVEKIT_FUNCTION_TOOL_STARTED`?
7. Transovo `execute_voice_v3_livekit_tool` on web?
8. `response.completed` + `voice_v3_llm_metrics_collected` with `isLikelyBackendResponses: true`

Classify first failed boundary: **A** (no delegation) · **B** (delegation, no response.created) · **C** (wrong tool surface) · **D** (Astra chose no tools) · **E** (function_call, no handler) · **F** (handler, no HTTP).

**STOP** after the report — no behavioral fixes until the boundary is proven.

## Old vs new payload comparison

Structural comparison (no auto-fix):

- **Old (working direct GPT-Live):** `buildBasicLiveSession` / `buildVoiceV3AstraDelegationResponses()` in `src/lib/voice-v3-basic/live-session-config.ts` and `src/lib/voice-v3/intake/delegation-config.ts`.
- **New (LiveKit):** `VOICE_V3_GPT_LIVE_SESSION_START_DELEGATION` log from the worker plus `buildVoiceV3Prompts()` for Amy/Astra instruction parity.

Compare: delegation type, models, `tool_choice`, `parallel_tool_calls`, tool count/names, reasoning/text options, Amy/Astra instruction **character counts** and delegation-policy sections (not full prompts in production logs).
