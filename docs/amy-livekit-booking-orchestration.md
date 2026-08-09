# Amy LiveKit Booking Orchestration

LiveKit is the active realtime voice runtime. This document defines how Amy completes booking inside `AgentSession` without reverting to the Telnyx `runtime_turn` hot path.

## Authority split

| Layer | Owns |
|-------|------|
| **LiveKit** | Realtime conversation, STT, LLM, TTS, model-facing function tools, tool-result feedback, interruption/turn handling, dynamic tool scoping |
| **Transovo** | Workflow state, required fields, validation, calendar integration, holds, booking permission, idempotency, receipts, DB persistence, provider writes, business rules |
| **Gemma** | Conversational intelligence only — not authoritative over workflow state |

Gemma must never decide a booking is allowed because it believes enough information was collected. The deterministic Transovo runtime makes that decision.

## Call flow

```
Caller
  ↓
Deepgram Flux STT + EOT
  ↓
Gemma 4 31B
  ↓
LiveKit function tool
  ↓
Transovo domain action / runtime
  ↓
DB / calendar provider / business rules
  ↓
structured tool result
  ↓
Gemma
  ↓
ElevenLabs Flash TTS
```

Do **not** recreate the old blocking HTTP `runtime_turn` path. Do **not** expose internal domain functions (`executeContinueWorkflow`, `calendar_availability`, provider writes) directly to the LLM.

## Model-facing tools

| Tool | Responsibility |
|------|----------------|
| `get_booking_requirements` | Return customer-configured required fields and active field |
| `record_current_field` | Save caller answer for the runtime-determined active field |
| `check_availability` | Query real calendar availability via existing domain services |
| `select_slot` | Resolve natural-language slot choice against returned slots |
| `confirm_booking` | Commit booking after explicit caller confirmation |
| `request_human` | Escalate to a human |
| `take_message` | Capture a message when booking is not appropriate |
| `end_call` | End the call cleanly when workflow is complete |

## Dynamic tool scopes

Tool visibility is driven by deterministic workflow state via `task-guard.ts` and refreshed after every tool call through `syncAmyAgentFromContext()`.

| Scope | Available tools |
|-------|-----------------|
| DISCOVERY | `get_booking_requirements`, `take_message`, `request_human` |
| COLLECTING_FIELDS | `record_current_field`, `request_human` (+ `check_availability` pre-registered for same-turn chains) |
| CHECKING_AVAILABILITY | `check_availability`, `request_human` |
| SELECTING_SLOT | `select_slot`, `check_availability`, `request_human` |
| READY_TO_BOOK | `confirm_booking`, `request_human` |
| COMPLETE | `end_call` |

After every successful `record_current_field`:

1. Update in-memory session workflow state
2. Determine next state
3. Call `agent.updateTools()` immediately
4. Call `agent.updateInstructions()` with phase-specific task context
5. Log `amy_agent_sync` with `previousState`, `newState`, `previousTools`, `newTools`

**Same-turn tool chains:** LiveKit reuses the tool context captured at the start of a speech turn when the model chains tool calls (e.g. `record_current_field` → `check_availability` → `select_slot` → `confirm_booking`). We pre-register *all downstream* task tools via `toolsForTaskWithChain()` so chained calls are not rejected as `unknown AI function`. Domain actions still enforce the active task via `taskToolGuard`.

## Truthfulness rules

- Never say "let me check availability" without calling `check_availability` when that tool is available
- Never offer a time not returned by `check_availability`
- Never say "you're booked" until `confirm_booking` returns success
- Never invent availability as fallback behavior

## Key files

| Purpose | Path |
|---------|------|
| LiveKit tools + sync | `voice-runtime/src/amy-tools.ts` |
| Domain actions | `src/lib/voice/domain-actions/booking-actions.ts` |
| Task scoping | `src/lib/voice/domain-actions/task-guard.ts` |
| Model-friendly results | `src/lib/voice/domain-actions/tool-results.ts` |
| Permanent + task prompt | `src/lib/agents/appointment-booking/intelligence/amy-livekit-prompt.ts` |
| Fast field path | `src/lib/voice/field-runtime/save-voice-fast.ts` |
| Scheduling backend | `src/lib/voice/workflow-engine/continue-workflow.ts` |

## Audit summary (2026-03-09)

### KEEP
- LiveKit `AgentSession` pipeline in `voice-runtime/src/main.ts`
- Task-scoped tools in `amy-tools.ts` with `syncAmyAgentFromContext`
- Domain actions delegating to existing workflow/calendar services
- Hot session state in `realtime-session/`
- No `runtime_turn` on LiveKit path

### ADAPT
- Rename `record_field` → `record_current_field` for model surface
- Add `get_booking_requirements` tool
- Phase-specific task context and richer tool descriptions
- Model-friendly structured tool results
- Enhanced `amy_agent_sync` transition logging

### REMOVE FROM LIVEKIT HOT PATH
- `runtime_turn` webhook orchestration (Telnyx only)
- Exposing internal scheduling functions to Gemma

### MISSING (follow-up)
- Full PSTN acceptance test through provider write
- Real `request_human` transfer wiring
- `tool_expected_but_not_called` runtime detection on speech turns

## Tests

```bash
npm run test:amy-livekit-preprod
npm run test:voice-livekit-booking-orchestration
npm run test:amy-livekit-full-booking
npm run audit:livekit-booking-steps
```
