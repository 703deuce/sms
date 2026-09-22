# Voice V3 LiveKit — Native GPT-Live Delegation Certified (behavioral)

**Date:** 2026-09-20  
**Certification call:** LiveKit job `AJ_sXE7NzDkuVMp` (~08:59–09:02 UTC)  
**Agent:** WS1 cert (`+15717491060`, workspace `ws_1`, Microsoft 365 booking)

## Verdict

The **documented LiveKit GPT-Live architecture is proven end-to-end** on a real PSTN call. Do **not** add a caller-transcript → forced Responses bridge or a compensating orchestrator for the earlier zero-tool call (`AJ_9a4soz3r6fkB`).

| Layer | Status |
|-------|--------|
| SIP / room bootstrap | ✓ |
| Amy (GPT-Live frontend) | ✓ |
| Native delegation to Responses / Astra | ✓ (behavioral) |
| Astra function-tool selection | ✓ |
| LiveKit FunctionTool execution → Transovo HTTP | ✓ |
| Structured tool results → Astra loop | ✓ |
| Microsoft find + book | ✓ |
| Provider confirmation (`BOOKING_CONFIRMED`) | ✓ |

Wire-level delegation observability (PR #448) remains **useful, not blocking** for architecture certification.

## Observed tool chain (authoritative)

```
set_scheduling_preference
  → find_availability (Microsoft)
  → book_appointment
      → MISSING_REQUIRED_INFORMATION (not_ready, no Graph write)
  → update_intake × N
  → book_appointment
      → BOOKING_COMMIT_SENT → MICROSOFT_EVENT_CREATED → BOOKING_CONFIRMED
      → VOICE_TOOL_EXECUTION_SUCCEEDED (status: confirmed)
```

This demonstrates:

1. **Multi-step tool loop** — Astra read failure, mutated intake, retried book.
2. **Business-layer guard** — first book blocked before Microsoft write.
3. **No fake success** — confirmation only after provider event.

## Contrast: earlier zero-tool call

Job `AJ_9a4soz3r6fkB` (~08:30 UTC): utterances committed, `toolCount: 17`, **zero** `execute_voice_v3_livekit_tool` successes. That call is an **environment/timing or session anomaly**, not proof that native delegation is impossible. Treat as a separate reliability investigation; do not redesign architecture around it.

## Next engineering focus (post-cert)

1. **Intake / state efficiency** — avoid `book_appointment` as a readiness probe (see `VOICE-V3-LIVEKIT-ASTRA-INTAKE-STATE.md`).
2. **17-tool surface audit** — documented in intake state doc (`16` Astra schemas + `1` native `EndCallTool`).
3. **Continuous multi-field intake** — `update_intake` batching vs per-field LiveKit tools.
4. **Interruption / concurrency** — torture matrix (not started).

## Deploy note

Success call ran on voice worker commit **`800203ab`** (manual Coolify redeploy). Web and voice SHAs should be tracked per `docs/COOLIFY-TRANSOVO-VOICE-WORKER.md`.
