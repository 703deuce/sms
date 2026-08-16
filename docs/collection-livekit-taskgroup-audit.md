# Collection layer audit — LiveKit TaskGroup vs current runtime

**Date:** 2026-08-16  
**Status:** Architectural audit + migration direction (supersedes transcript-patching as the long-term fix)

---

## Executive summary

We have been running **generic receptionist collection** on the wrong layer: the main OpenAI Realtime `AgentSession` plus `UserInputTranscribed` → `processCollectionTurn` → semantic extract → persist → `askNextCollectionField`. That duplicates work LiveKit designed **AgentTask / TaskGroup** to isolate.

PR #204 improves that path (fragment buffers, single-field prompts) but is still **symptom control** on an architecture LiveKit did not intend for structured intake.

**Recommendation:** Move conversational collection into **TaskGroup-owned AgentTasks** while keeping **Transovo runtime** authoritative for manifest, validation, state, idempotency, availability, and provider writes.

---

## What LiveKit intends

From LiveKit examples (`examples/healthcare`, `examples/survey`, `examples/frontdesk`) and SDK `TaskGroup`:

```
Main agent (Amy) — intent, FAQ, natural conversation
        ↓ handoff / await
TaskGroup — sequences discrete collection objectives
        ↓ each step
AgentTask — owns ONE field until typed result (phone_number, email, custom)
        ↓
TaskGroupResult → runtime continues (availability, booking commit)
```

TaskGroup supports:

- Ordered collection with **regression** (`out_of_scope` tool returns to prior tasks)
- Shared `chat_ctx` across tasks
- Optional summarization on completion (disable for Realtime — we already do this in `task-context.ts`)

Prebuilt tasks in **Python SDK** (`GetPhoneNumberTask`, `GetEmailTask`, `GetNameTask`, `GetAddressTask`) own noisy digit/email/name collection with confirmation and normalization.

---

## What Transovo runs today (generic receptionist)

| Layer | Implementation | Problem |
|-------|----------------|---------|
| Main agent | `createGenericReceptionistAgent` + OpenAI Realtime | Correct for open conversation |
| Collection trigger | `beginDeterministicFieldCollection` → scripted `promptCollectionField` | OK for *asking* one question |
| Turn intake | `UserInputTranscribed` → `handleCollectionUtterance` → `processCollectionTurn` | **Wrong owner** — main session treats each finalized STT fragment as a collection turn |
| Multi-field extract | `extractFieldsFromUtterance` (all missing fields until #204 scoped active) | Volunteer answers OK in principle; execution was on wrong layer |
| Advance | `advanceCollectionAfterFieldSaved` → `askNextCollectionField` | Competes with Realtime `create_response` / generation chain |
| Turn detection | OpenAI `semantic_vad` + runtime toggles `create_response: false` during collect | Two turn owners; not LiveKit audio turn detector |
| Legacy parallel | `ReceptionistFieldCollectionTask` (unordered, `record_caller_field`) | Exists but **not** used by generic receptionist inbound path |

Real-estate front desk partially aligns: `IntakeSequenceCollectionTask` is one AgentTask for the sequence (avoids per-field handoff latency), with `record_additional_intake_field` for volunteer data.

Amy legacy path (`amy-receptionist-agent.ts`) uses `runCollectCallerFieldsTaskGroup` — **correct LiveKit pattern**, but test-only / not production inbound.

---

## TypeScript SDK gap (important)

In `@livekit/agents` (sms `node_modules`):

| Available in TS | Not in TS npm package |
|-----------------|----------------------|
| `workflows.TaskGroup` | `GetPhoneNumberTask` |
| `workflows.WarmTransferTask` | `GetEmailTask`, `GetNameTask`, `GetAddressTask` |
| `voice.AgentTask` | `GetDtmfTask` |

Prebuilt collection tasks are **Python `beta.workflows` only** today. Transovo must **port behaviors** into TS `AgentTask` subclasses (digit accumulation, email normalization, spelling), not import prebuilt classes.

---

## Root causes of bugs we saw

| Symptom | Root cause on current architecture |
|---------|-----------------------------------|
| Two questions at once ("phone and email?") | `controlledGenerateReply` re-ask instructions + main agent `create_response` during collection |
| Phone cut off at "571…" | Finalized STT fragment treated as turn complete on **main session** before digit buffer satisfied |
| Spelling pauses advance field | Same — fragment-level turn completion without task-owned collection loop |
| Duplicate generations | Main Realtime + runtime `controlledGenerateReply` + `askNextCollectionField` speech |
| `record_current_field` confusion | Removed from hot path; model/tools still tempted when session owns collection |

These are **not** primarily "VAD too fast." They are **wrong process boundary**: main agent doing Task work.

---

## Target architecture (preserve deterministic runtime)

```
Caller utterance
      ↓
[Inside active AgentTask OR pre-task semantic pass]
Semantic extraction — all recognizable fields + corrections
      ↓
Per-field validation (manifest-driven)
      ↓
userData.receptionistFields + authoritativeFieldIds
      ↓
TaskGroup state — skip satisfied tasks, one ask at a time
      ↓
When manifest complete → runtime BOOKING_CHECK_AVAILABILITY (no model)
      ↓
Caller confirms slot → writeBookingToProvider (transaction-first, PR #203)
```

**Rules:**

1. **One question at a time** — TaskGroup only runs tasks for missing fields; each task asks one manifest question.
2. **Accept many answers at once** — semantic extractor fills all valid fields from one utterance; TaskGroup skips completed tasks.
3. **Extraction ≠ validation** — phone `571` stays incomplete; name correction replaces phone without being on phone task.
4. **Amy does not own booking writes** — unchanged from transaction-first commit.

---

## Turn detection recommendation

LiveKit docs: use **LiveKit audio turn detector** for most agents; with OpenAI Realtime, **disable Realtime built-in turn detection** to avoid dual owners.

Current sms: OpenAI `semantic_vad` / `server_vad` via `realtime-turn-config.ts`, toggled by `syncCollectionRealtimeMode`.

**During TaskGroup collection:**

- Tasks should own turn boundaries for structured fields (phone task loops until tool success).
- Main agent turn detection should not finalize collection answers.
- Evaluate LiveKit turn detector when `@livekit/agents` TS support matches Python examples; until then, **AgentTask isolation** matters more than global VAD retuning.

Do **not** add blanket silence delays on normal conversational fields.

---

## Migration phases

### Phase 1 — TaskGroup for generic receptionist (wired)

- `runReceptionistCollectionTaskGroup` — builds `TaskGroup` from `fieldManifest`, skips complete fields
- `PhoneNumberCollectionTask` — TS port of `GetPhoneNumberTask` digit merge + confirmation (uses `captureUsPhoneDigits`)
- `ManifestFieldCollectionTask` — custom manifest fields + `record_additional_field` for volunteers
- `collection-entry.ts` + `beginReceptionistCollection` — routes TaskGroup vs legacy (`RECEPTIONIST_COLLECTION_LEGACY=1`)
- `workflow-intent-activation` → `beginReceptionistCollection` instead of `beginDeterministicFieldCollection`
- `handleCollectionUtterance` skipped while `receptionistCollectionTaskGroupActive`
- On complete: booking → `finishBookingCollectionAndListSlots`; message → `MESSAGE_COMMIT`
- Scripted `speakReceptionistCollectionLine` for prompts (no `generateReply` for questions)

### Phase 2 — Specialized tasks

- Email task (port `GetEmailTask` behavior or adapt `email-collection-task.ts`)
- Name / spelling task (optional spelling verification)
- Address task (multi-fragment merge)

### Phase 3 — Turn detection alignment

- Audit LiveKit audio turn detector in TS pipeline
- Disable conflicting Realtime turn_detection during TaskGroup
- Keep semantic VAD for main agent only

### Phase 4 — Deprecate

- `processCollectionTurn` hot path for production receptionist
- `controlledGenerateReply` for collection re-asks (clarification → brief answer + deterministic re-prompt only if needed outside tasks)
- `ReceptionistFieldCollectionTask` unordered path (merge into TaskGroup)

---

## What we keep from PR #204 / #203

| PR | Keep |
|----|------|
| #203 transaction-first | Booking/transfer/cancel/reschedule provider writes — **permanent** |
| #204 fragment buffers | Logic **moves into** PhoneNumberCollectionTask / validators; not main-session transcript handler |
| #204 single-field prompt guard | Enforced by TaskGroup (only one active task) + manifest question per task |
| #204 semantic active-field scope | Expands to multi-field extract + skip in TaskGroup builder |

---

## Acceptance tests (TaskGroup path)

1. Phone in three paused groups → one `phone_number` result, no next-field prompt mid-sequence
2. Compound utterance (name + phone + address) → three fields saved, only email asked
3. Spelled last name with pauses → single name value before task completes
4. Phone correction mid-intake → replaces phone, does not require phone task to be active
5. Normal reason field → no artificial delay
6. No bundled prompt in task `onEnter` speech

---

## References

- `examples/healthcare/agent.py` — TaskGroup + GetPhoneNumberTask
- `examples/survey/agent.py` — TaskGroup regression
- `livekit-agents/.../phone_number.py` — GetPhoneNumberTask implementation
- sms `voice-runtime/src/tasks/collect-field-task.ts` — Amy TaskGroup (reference)
- sms `voice-runtime/src/frontdesk/real-estate/intake-sequence-collection-task.ts` — single-task sequence pattern
- sms `docs/ai-receptionist-runtime-implementation.md` — original spec (TaskGroup mentioned, not wired for generic)
