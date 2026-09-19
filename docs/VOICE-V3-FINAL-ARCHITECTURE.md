# Voice V3 — Final architecture (target)

## Ownership

| Layer | Owner |
|-------|--------|
| Duplex conversation (listen, speak, interrupt, pacing) | **GPT-Live / Amy** |
| Reasoning and **which tool to call** | **GPT-6 Astra** (Responses delegation) |
| Tool validation, authoritative `CallContext`, safe execution | **Transovo** |
| Calendar truth | **Microsoft Graph** (system of record) |

## Flow

```
PHONE ↔ GPT-Live (continuous)

GPT-Live ──delegation──► GPT-6 Astra
                              │
                              ▼ function_call(s)
                         Transovo tool runtime
                              │
                              ▼
                         Microsoft / external
                              │
                              ▼ tool result (JSON)
                         function_call_output
                              │
                              ▼ (when batch complete)
                         response.create  ← protocol only
```

**LLM requests. Transovo authorizes. Provider executes/confirms. LLM communicates.**

## Invariants

1. **Claim gating, not speech gating** — tools and `allowedClaims` constrain what may be stated as fact; they do not schedule ordinary conversation.
2. **Protocol `response.create` ≠ “Amy speak now”** — required after all `function_call_output` items in a delegated batch (OpenAI + LiveKit batch fix).
3. **Background work does not freeze Live** — FIND/BOOK run concurrently; Amy may continue intake.
4. **State/context updates are non-destructive** — no automatic cancel/supersede of active Live audio on `state_version` change.
5. **One production path** — no parallel planner-driven tool dispatch.

## Tool surface (capability-oriented)

- `update_intake` — dynamic fields from `AgentConfig`
- `find_availability`
- `book_appointment`
- `find_appointment` / `reschedule_appointment` / `cancel_appointment` (lifecycle)
- `transfer_call` / `end_call` when backend required

## Observability (primary log lines)

`VOICE_TOOL_REQUESTED` → `VOICE_TOOL_VALIDATED` → `VOICE_TOOL_EXECUTION_*` → `VOICE_TOOL_OUTPUT_SUBMITTED` → `VOICE_DELEGATED_BATCH_CONTINUED`

Not: `CALLER_MEANING_APPLIED` → `PLANNER` → `SPEAK_COORDINATOR` → `response.create` on healthy paths.

## Code map

- Registry & dispatch: `src/lib/voice-v3/tools/`
- Delegation handler: `src/lib/voice-v3/tools/handle-delegated-voice-tools.ts`
- Protocol barrier: `src/lib/voice-v3/delegation/live-response-coordinator.ts`
- Safety preserved: `calendar/*`, `operations/*`, `evaluate-claims.ts`
