# Voice V3 LiveKit — How Astra Learns Intake State

**Context:** Native delegation certified on job `AJ_sXE7NzDkuVMp`. Premature first `book_appointment` on that call was **correctly rejected** (`MISSING_REQUIRED_INFORMATION`) then recovered via `update_intake` + second book.

This doc traces **where intake truth lives** on the LiveKit path and what changed to reduce probe-booking.

## Mental model

```
Caller speech
  → Amy (GPT-Live) delegates to Astra (Responses)
  → Astra selects FunctionTools
  → Python worker HTTP → executeVoiceV3ToolForLiveKit
  → Transovo runtime (in-memory per liveSessionId)
  → JSON tool result returned into Astra tool loop
  → Amy speaks
```

**Authoritative intake state** is `VoiceV3CallRuntime` snapshot (`context.intake.values`), not Amy’s transcript.

## Two channels (OpenAI Realtime vs LiveKit)

| Channel | Mechanism | LiveKit path today |
|---------|-----------|-------------------|
| **Thinking context** | `LiveContextPublisher.appendThinking(buildIntakeObjectiveContext(...))` after `update_intake` | **Disabled** — `sendContext: () => {}` in `voice-v3-livekit.ts` |
| **Tool results** | JSON returned from each tool execution | **Primary** — only channel Astra reliably sees between steps |

See `executeVoiceV3ToolForLiveKit` in `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`.

Implication: intake objective prose in `build-intake-context.ts` is **not** injected on LiveKit unless we wire a future sideband or enrich tool payloads (chosen fix below).

## What each tool already returned (before enrichment)

| Tool | Intake signal |
|------|----------------|
| `update_intake` | `missing_required_fields`, `objective.status` — tied to **active operation** from `dialog.activeGoal` |
| `find_availability` | Slots only; sets `activeGoal` → `BOOK_APPOINTMENT` on success path |
| `book_appointment` | `MISSING_REQUIRED_INFORMATION` + `missing_fields` when not ready |
| `set_scheduling_preference` | Scheduling generation only |

### Why the first book happened

1. **`find_availability` steers goal to booking** (`mergeDialogActiveGoalFromTool(..., "BOOK_APPOINTMENT")`) but historically **did not** return book-intake gaps.
2. While `activeGoal` was still `UNKNOWN` / `GENERAL`, `update_intake` reported `missing_required_fields: []` because **unresolved operation** has no configured requirements (`operation-requirements.ts`).
3. Astra cross-tool copy explicitly allowed “call when conversation suggests readiness; use errors to recover” (`astra-cross-tool-instructions.ts`) — so **probe book** was prompt-aligned.
4. Transovo **correctly** blocked Graph write; iterative loop fixed intake.

Desired flow (user spec):

```
One utterance → update_intake({ name, email, mother_s_name, service_reason })
  → INTAKE_UPDATED + current_intake + missing_required_fields + book_appointment.ready
  → if ready: set_scheduling_preference → find → book
  → else: Amy asks only for book_appointment.missing_fields
```

## Tool surface: 17 vs “11 catalog”

Resolved for cert agent `+15717491060` (`resolveVoiceV3LiveKitSession`):

| Bucket | Count | Names |
|--------|------:|-------|
| **Capability catalog** (Astra) | 10 | `update_intake`, `set_scheduling_preference`, `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment`, `transfer_call`, `request_callback` — no `end_call`, no `send_booking_link` for this config |
| **LiveKit intake helpers** | 6 | `set_intake_*` per wizard field + `collect_intake_field` |
| **Native Python only** | 1 | `EndCallTool` (`end_call`) — excluded from Astra schemas, **included** in `session_tools` / `toolCount` log |

**16** delegated schemas + **1** native end-call = **17** in `voice_v3_session_starting.toolCount`.

Verify locally:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-voice-v3-livekit-bridge.ts
```

(`RESOLVED_SESSION.toolNames` vs `expectedWizardTools`.)

LiveKit docs suggest ~5–10 tools per agent for selection accuracy. We are at 17 for cert — monitor mis-selection; splitting subagents is **not** recommended without evidence.

## Contract fix (this branch)

Added `buildToolIntakeProjection()` (`src/lib/voice-v3/intake-objective/tool-intake-projection.ts`) and attach to tool **success** payloads:

- `current_intake` — collected values + field status
- `active_operation` — from `dialog.activeGoal`
- `missing_required_fields` — for active operation
- `objective_status`
- **`book_appointment.ready`** and **`book_appointment.missing_fields`** — always computed for book, even when active operation is `unresolved`

Wired into:

- `update_intake`
- `set_scheduling_preference`
- `find_availability` (`available` / `none_available`)

Prompt tweak: cross-tool instructions now tell Astra to read `book_appointment.ready` before mutating calendar.

`book_appointment` errors unchanged (`missing_fields` in `details`).

## Future (not required for cert)

1. **LiveKit thinking injection** — map `session.thinking.append` to GPT-Live backend if LiveKit exposes a supported hook (parity with OpenAI Realtime sideband).
2. **Tool count reduction** — prefer `update_intake` over six `set_intake_*` when multi-field utterances are common (feature flag).
3. **Concurrency / barge-in** — separate test matrix.

## Related docs

- `docs/VOICE-V3-INTAKE-OBJECTIVE-REPORT.md` — intake objective architecture
- `docs/VOICE-V3-LIVEKIT-NATIVE-DELEGATION-CERTIFIED.md` — certification call summary
- `docs/VOICE-V3-LIVEKIT-JOB-AJ_9a4soz3r6fkB-DELEGATION-TRACE.md` — zero-tool call (historical)
