# Voice V3 — LiveKit delegation tool continuation (vs sideband)

**Question:** After `update_intake`, does Luna receive the tool result inside its active Responses delegation and remain able to call `set_scheduling_preference` / `find_availability` / `book_appointment`?

**Short answer (LiveKit PSTN):** Yes — **when** the delegated backend issued the function call and the LiveKit `GPTLiveModel` plugin completed the loop. That loop is **not** implemented in `handleDelegatedVoiceToolCall` on Node. It is implemented in **LiveKit Agents** (`gpt_live.py`) plus local `FunctionTool` handlers that call `execute_voice_v3_livekit_tool`.

`delegationId: null` on the Node executor is **expected** on the LiveKit path and was already true on the September monolith `executeVoiceV3ToolForLiveKit` bridge. It does **not** mean the tool result is dropped; the plugin submits `function_call_output` and may send `response.create` for continuation.

---

## Two transports (do not conflate)

| Aspect | **Sideband** (legacy `voice-v3-basic` / Telnyx live accept) | **LiveKit worker** (current Full Receptionist PSTN) |
|--------|--------------------------------------------------------------|-----------------------------------------------------|
| Observer | `attachVoiceV3LiveSideband` → nested `response.*` events | Python worker + `GPTLiveSession` events |
| Tool dispatch | `handleDelegatedAstraResponseEvent` → `handleDelegatedVoiceToolCall` | `function_tool` → `TransovoV3ToolClient.execute` |
| Node `delegationId` | Real ID from nested envelope | Often **null** on HTTP (plugin owns protocol) |
| Output return | `completeDelegatedFunctionCall` → `response.item.create` + `response.create` via coordinator | Plugin `_append_items` → `ResponseItemCreateEvent` + `_maybe_continue_response()` |
| `max_tool_steps` | App coordinator + provider rules | `AgentSession(max_tool_steps=…)` (default 5 in session bootstrap) |

Golden-era **LiveKit** used the right column. Golden-era **sideband** used the left. Comparing them as if they were the same path causes false “we lost delegation completion” conclusions.

---

## LiveKit continuation chain (authoritative)

```
Amy (gpt-live-1) delegates → Responses / Luna (responses_options.model)
  → response.output_item.done (function_call)
  → GPTLiveSession emits function_call
  → AgentSession runs LiveKit FunctionTool (Python)
  → POST execute_voice_v3_livekit_tool (Transovo business layer)
  → JSON tool result
  → FunctionCallOutput appended; if call_id ∈ backend_open_calls
  → ResponseItemCreateEvent(function_call_output)
  → response.create (when no pending calls) → Luna continues same delegation
```

References: `livekit.agents.llm._realtime.gpt_live` (`_handle_response_event`, `_append_items`, `_maybe_continue_response`). Project directive: `docs/VOICE-V3-LIVEKIT-MIGRATION-DIRECTIVE.md` (“no manual continuation” on LiveKit).

---

## What Node still owns on LiveKit

- Business tools (`update_intake`, FIND/BOOK preconditions, calendar dispatch)
- `liveContextEvents` (thinking/commentary) — should use **delegation-scoped** `delegation_id` when known so Luna sees intake objective context, not only Amy
- Delegation hydration on `session.delegation.created` (client target) — `delegation_runtime_hydration.py`
- Forensics (`GPT_LIVE_DELEGATION_*` events)

Node does **not** own `response.create` for delegated protocol continuation on LiveKit.

---

## Call 2 class of failure (tools present, one intake tool)

If `execute_voice_v3_livekit_tool` ran once for `update_intake` and never for scheduling/booking:

1. **Plugin continuation worked** for that single tool (output was accepted). Luna then **ended** the delegated response without further function calls → **model/orchestration**, not missing FIND/BOOK guards.
2. **Amy spoke** without a fresh delegation → no backend tools (Mode A).
3. **Rare:** plugin/protocol failure (stuck `_backend_open_calls`) — look for missing client `function_call_output` events in forensics after `response.output_item.done` for `update_intake`.

Distinguish via forensics: `GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED`, `response.completed` function_names list, and `voiceToolExecution` rows per tool.

---

## Tests

- Sideband wiring: `scripts/test-voice-v3-tool-architecture.ts` (output + continuation via coordinator `send`)
- LiveKit architecture + multi-tool state: `new-app/scripts/test-voice-v3-delegation-continuation-architecture.ts`
- Python delegation parse: `voice-runtime-python/tests/test_gpt_live_delegation_telemetry.py`

---

## Correction (Oct 2026)

Worker now forwards **active `delegationId`** from `response.event` envelopes into `execute_voice_v3_livekit_tool` so Node `liveContextEvents` from intake tools attach to Luna’s delegation, matching sideband scoping behavior without reintroducing Node `response.create` on LiveKit.
