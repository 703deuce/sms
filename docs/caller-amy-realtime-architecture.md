# Caller Amy Realtime Architecture

## Phase 1 — Audit Summary

### Request path (before refactor)

```
Telnyx STT/LLM
  → POST /api/telnyx/voice/tools (toolType=runtime_turn)
  → executeBuiltinVoiceAction → executeAmyRuntimeTurn()
  → computeWorkflowState() [DB: voiceCall + metadata.agentRuntime]
  → getWorkflowRequirements() [DB: voiceCall + field defs + session]
  → ensureWorkflowFieldSession() [DB read/write]
  → executeContinueWorkflow() / recordCurrentField()
  → internal: calendar_availability, hold, book [Calendly + DB]
  → saveAgentRuntime() [DB write]
  → HTTP JSON response (Telnyx blocks LLM until this returns)
```

### Telnyx constraint (evidence)

- `src/lib/voice/telnyx/assistant-tools.ts` — webhook tools use synchronous HTTP; `runtime_turn` has 30s timeout.
- No async tool completion callback in our Telnyx integration — LLM cannot proceed until webhook returns.
- Filler speech via `latency-profiles.ts` is Telnyx-native only; we cannot split one tool call into ack + later result without platform support.

### DB hot-path (typical turn)

- 3–6× `voiceCall` reads (computeWorkflowState, loadAgentRuntime, field session, metadata slots)
- 2–4× `voiceCall` writes (runtime, field session, availability metadata)
- Agent/version/config reload via `loadWorkflowFieldDefinitions` each turn
- N+1 on requirements chain

### External calls

- Calendly availability (CHECKING_AVAILABILITY) — **must block** for authoritative slots
- hold_appointment_slot / book_appointment — **must block** for authoritative booking
- CRM lookup — only on explicit transfer/message paths

### Deployment

- Coolify-hosted Next.js (persistent process, horizontally scalable)
- Redis available via `REDIS_URL` (BullMQ) — now used for realtime sessions when set
- Without Redis: in-memory store (dev/single-instance only; logged warning in production)

## Phase 2–6 — New architecture

```
Telnyx → /api/telnyx/voice/tools
  → executeRealtimeSessionTurn() [session controller]
  → RealtimeSessionStore (Redis or memory)
  → StaticSessionConfig cache (agent fields, timezone — loaded once)
  → FAST: intent routing, field prompts, cached state [no external]
  → SLOW (authoritative): continue_workflow → Calendly/hold/book [measured separately]
  → TurnLatencyTracker → structured log per turn
```

### Session initialization

- `ensureVoiceCallForToolWebhook` → `initializeRealtimeSessionForCall`
- Hangup: `destroyRealtimeSession` in TeXML status callback

### Model-facing tools

- `runtime_turn` (+ native `hangup` on Telnyx)

### Internal-only actions

- calendar_availability, book_appointment, hold_appointment_slot, record_current_field, continue_workflow, etc. (see `CALLER_AMY_INTERNAL_ONLY_TOOLS`)

## Latency targets

| Turn type | Target |
|-----------|--------|
| Fast routing (no external) | p50 < 150ms, p95 < 300ms |
| Field update | p95 < 500ms |
| Availability/booking | measured separately; does not contaminate routing metric |

## Benchmark

```bash
npm run test:caller-amy-realtime-benchmark
```
