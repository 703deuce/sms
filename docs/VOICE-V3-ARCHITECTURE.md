# Voice V3 architecture

Voice V3 does **not** use LiveKit. LiveKit’s open-source agent source was studied only as a **reference for responsibility boundaries** (model chooses tools, application executes, calendar is system of record). Voice V3 implements a **minimal runtime** directly on:

**Telnyx SIP → OpenAI GPT-Live (Amy) → Responses delegation → GPT-6 Astra → Transovo tools → Microsoft / Telnyx**

## Ownership

| Layer | Owns |
|--------|------|
| **GPT-Live / Amy** | Listening, speaking, turn timing, interruptions, natural conversation |
| **GPT-6 Astra** | Reasoning, intent, **function tool selection**, tool arguments |
| **Transovo** | Tool registry, validation, authorization, `CallContext`, idempotency, stale protection, provider adapters |
| **Microsoft / Telnyx** | External truth (calendar, telephony) |

**Model requests → code validates → provider confirms → model communicates.**

## Minimal runtime (what we built)

We did **not** rebuild VAD, endpointing, or a generic `AgentSession`. GPT-Live is server-driven for conversation.

Our session layer:

- OpenAI sideband + delegation correlation
- `VoiceToolRegistry` / tool executor
- Delegated tool batch barrier (`function_call_output` × N → one protocol `response.create`)
- `VoiceV3CallRuntime` / `CallContext`
- Telemetry

## Healthy path

```
CALLER ↔ GPT-Live
              │ delegation
              ▼
         Astra → function tool
              ▼
    Transovo tool.execute()
              ▼
         Provider
              ▼
    tool result → Astra / Live ↔ CALLER
```

## Tools (Astra only — Amy does not see tool schemas)

`update_intake`, `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment`, `transfer_call`, `end_call`

## Protocol

Per completed function call: `response.item.create` with `function_call_output` (matching `call_id`). After all pending outputs in the batch: **one** bare `response.create` to continue delegated Responses work — **not** “Amy speak now.”

Application `response.create` for ordinary turns is **blocked** except documented initial greeting bootstrap.

## Removed from healthy path (deleted, not gated)

Production code removed — not feature-flagged:

- `emit_caller_meaning` / `emit-caller-meaning-tool.ts`
- `apply-extracted-meaning.ts` (meaning gateway + planner speak side effects)
- `direct-caller-meaning-extraction.ts`, `semantic-extraction-retry.ts`
- `live-speak-sync.ts` / `syncPlannerSpeakToLive`
- `parse-astra-meaning-response.ts`, `extract-raw-meaning-arguments.ts`

`delegation-timing.ts` (legacy import path `semantic-turn-watchdog.ts`) is delegation timing only — no conversational authority.

Production tools use `merge-intake-state.ts` (`applyIntakeToolPatch`, scheduling/goal merge). `apply-caller-meaning.ts` and `caller-meaning-schema` remain for scripts/tests and standalone decoder tests only — not imported from `src/lib/voice-v3/tools/` or `call-runtime`.

- Planner-driven speech and `nextConversationAction` → `response.create` (diagnostics only; action forced to `NONE`)
- `CALLER_TURN_COMMITTED` has zero conversational authority
- Recovery → ordinary speak orchestration

## Preserved execution safety

OfferSet, scheduling generations, stale FIND, operation registry, bookingAttemptId, fresh BOOK revalidation, OUTCOME_UNKNOWN, reconciliation.

## Code map

- `src/lib/voice-v3/tools/` — registry and tools
- `src/lib/voice-v3/intake/handle-delegated-meaning.ts` — delegation → tools
- `src/lib/voice-v3/delegation/live-response-coordinator.ts` — protocol barrier
- `src/lib/voice-v3/agent/after-state-change.ts` — invariants + verified booking commentary only
