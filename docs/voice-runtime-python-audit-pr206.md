# PR #206 Audit — Single Ownership & HTTP Bridge

**Branch:** `cursor/python-voice-runtime-7c56`  
**Status:** Phase 1–3 — **not** production-proven  
**Invariant:** ONE caller utterance → ONE conversational owner → at most ONE response generation

This audit was performed before narrow smoke deployment. Fixes from this audit are included in the same branch.

---

## Executive summary

| Area | Pre-audit risk | Post-audit state |
|------|----------------|------------------|
| Opportunistic extraction during TaskGroup | **High** — global `user_input_transcribed` ran `extract_fields` on every final transcript while tasks were active | **Fixed** — gated to `IDLE` / `FAQ` only; `intake_active` flag blocks intake |
| Field persist blocking next prompt | **High** — `on_task_completed` awaited HTTP persist; TaskGroup awaits callback before next task | **Fixed** — local `ud.collected_fields` updated immediately; persist via `asyncio.create_task` |
| Booking confirmation double speech | **Medium** — `session.say()` + tool return text could trigger model speech | **Fixed** — deterministic `say()` only; tool returns silent instruction |
| Telemetry for smoke test | **Low** — missing `task_started`, availability, `receipt_persisted` | **Fixed** |

**Remaining gaps (not blockers for narrow booking smoke):** leave-message DB persist, transfer/cancel/reschedule in Python, browser voice-test parity, real-estate/outbound still on TS worker.

---

## Ownership model

### Conversational owners

| Phase | Utterance owner | Speech owner | Tool owner |
|-------|-----------------|--------------|------------|
| IDLE / general | Amy (`Agent` + Realtime) | Amy | Amy tools |
| Booking intake (`TaskGroup`) | Active `AgentTask` (Beta or `DynamicFieldTask`) | Active task via `on_enter` → `generate_reply` | Active task tools only |
| Availability / slot / confirm | Amy (tool still open from `start_booking` chain or follow-up turns) | Amy Realtime | Amy tools (`select_slot`, `confirm_booking`) |
| FAQ | Amy | Amy | `get_business_answer` |

During intake, Amy's `start_booking` tool **awaits** `TaskGroup` — Amy does not generate independent replies while tasks run. LiveKit routes user audio/transcripts to the **active task** in the session stack.

### Opportunistic extraction (observe-only)

| Question | Answer |
|----------|--------|
| When does it run? | Only when `should_run_opportunistic_prefill(ud)` is true: `workflow ∈ {IDLE, FAQ}` and `intake_active == false` |
| What does it consume? | Final transcript from `user_input_transcribed` |
| Can it generate speech? | **No** |
| Can it call Amy tools? | **No** |
| Can it advance workflow? | **No** — only updates `ud.collected_fields` candidates and async persist |
| Competes with active task? | **No** (after fix) — disabled during intake and post-intake booking flow |

Implementation: `session/inbound.py` → `opportunistic_prefill()` in `workflows/booking_intake.py`

---

## Per-phase utterance audit

### IDLE / general conversation

| # | Question | Answer |
|---|----------|--------|
| 1 | Receives utterance | Amy Realtime via `AgentSession` |
| 2 | Allowed to generate speech | Amy |
| 3 | May call tools | Amy (`start_booking`, `take_message`, `get_business_answer`) |
| 4 | Opportunistic extraction consumes? | **Yes** (observe-only, IDLE) |
| 5 | Extraction triggers conversational action? | **No** |
| 6 | Transcript callback → extra `generate_reply`? | **No** (extraction has no session access) |
| 7 | Amy + Task both respond? | **No** (no active task) |

### BookingIntakeTaskGroup (container)

| # | Question | Answer |
|---|----------|--------|
| 1 | Receives utterance | Active child task (`GetNameTask`, etc.) |
| 2 | Speech | Child task |
| 3 | Tools | Child task tools |
| 4 | Opportunistic extraction? | **No** |
| 5 | Extraction triggers action? | **No** |
| 6 | Extra `generate_reply` from callbacks? | **No** |
| 7 | Amy + Task both respond? | **No** — Amy blocked on `await run_booking_intake_task_group` |

Orchestrator: `workflows/booking_intake.py` → `run_booking_intake_task_group` → LiveKit `TaskGroup`

### GetNameTask

| # | Answer |
|---|--------|
| 1 | `GetNameTask` (LiveKit Beta) |
| 2 | Task `on_enter` → `generate_reply` |
| 3 | Task name tools |
| 4 | **No** opportunistic extraction |
| 5 | **No** |
| 6 | **No** |
| 7 | **No** dual owner |

Completion → `on_task_completed` → local field update + async `persist_intake_fields`

### GetPhoneNumberTask (slow multi-part phone)

| # | Answer |
|---|--------|
| 1 | `GetPhoneNumberTask` — handles partial utterances ("571 … 477 … 6175") via `update_phone_number` tool across turns |
| 2 | Task — may ask for area code / digits across turns until regex valid |
| 3 | `update_phone_number` / optional `confirm_phone_number` |
| 4–7 | Same as GetNameTask — single owner until complete |

Phone completes **once** when full number validates → one `field_completed` event.

### GetEmailTask / GetAddressTask

Same pattern as GetNameTask.

### DynamicFieldTask

| # | Answer |
|---|--------|
| 1 | `DynamicFieldTask` |
| 2 | `on_enter` → `generate_reply` with manifest question |
| 3 | `record_field_value` → `complete()` |
| 4–7 | No extraction; no dual owner |

### Slot selection (`BOOKING_SELECT`)

| # | Answer |
|---|--------|
| 1 | Amy Realtime (intake complete; `start_booking` returned slot lines) |
| 2 | Amy |
| 3 | `select_slot` tool |
| 4 | **No** opportunistic extraction (`workflow != IDLE/FAQ`) |
| 5–7 | **No** competition |

### Booking confirmation (`BOOKING_CONFIRM` → `confirm_booking`)

| # | Answer |
|---|--------|
| 1 | Amy |
| 2 | Amy until `confirm_booking` → **deterministic** `session.say(confirmationSpeech)` |
| 3 | `confirm_booking` |
| 4 | **No** extraction |
| 5–6 | **No** |
| 7 | **No** — tool return explicitly suppresses model repeat |

---

## Internal HTTP bridge classification

Base: `POST /api/internal/voice-runtime`  
Client: `integrations/backend_client.py` → `TransovoBackend.call()`

| Action | Classification | Blocks next conversational prompt? | Notes |
|--------|----------------|--------------------------------------|-------|
| `bootstrap_inbound` | Transaction-critical (pre-call) | Yes (once, before greeting) | Required to load manifest + call row |
| `persist_intake_fields` (bootstrap empty) | Durable persistence | Yes (once pre-greeting) | Loads prior `pythonIntakeFields` from metadata |
| `extract_fields` | Async/non-blocking observer | **No** (when gated) | Only IDLE/FAQ; never during intake |
| `persist_intake_fields` (per field) | Durable persistence | **No** (after fix) | Fire-and-forget from `on_task_completed` |
| `persist_intake_fields` (opportunistic) | Durable persistence | **No** | Fire-and-forget after local merge |
| `get_availability` | Blocking conversational request | Yes — intentional | Runs after intake; Amy waits before offering slots |
| `commit_booking` | Transaction-critical | Yes — intentional | Provider write + receipt; then deterministic `say()` |
| `business_answer` | Blocking conversational request | Yes — FAQ turn | Amy awaits answer text |
| `emit_event` | Async/non-blocking | No | Bridge logging only |

**Design rule:** conversational state lives in `SessionUserData` (`userdata.py`). HTTP persist never gates the next task prompt.

---

## Expected call sequence (AC → real Calendly booking)

Example manifest: name, phone, email, service address (dynamic).

| Step | Caller / Amy | Python owner | Key functions / classes |
|------|--------------|--------------|-------------------------|
| 0 | Worker boots | `main.py` | `entrypoint` → `run_inbound_session`; log `worker_ready` |
| 1 | Greeting | Amy | `inbound.py` → `session.generate_reply` (greeting) |
| 2 | "My AC isn't getting cold" | Amy | Realtime → intent; may call `start_booking` |
| 3 | Amy recognizes booking | Amy tool | `agent/tools.py` → `start_booking`; log `intent_selected` (`intent=booking`) |
| 4 | TaskGroup starts | TaskGroup | `run_booking_intake_task_group`; log `task_group_started` |
| 5 | "What's your name?" | GetNameTask | `task_started` (fieldId=name) → `GetNameTask.on_enter` |
| 6 | "Anthony Johnson" | GetNameTask | Task tools → complete → `field_completed` name; async persist |
| 7 | "What's your phone?" | GetPhoneNumberTask | `task_started` phone → `GetPhoneNumberTask.on_enter` |
| 8 | "571 … 477 … 6175" (slow) | GetPhoneNumberTask | `update_phone_number` across partial turns → one `field_completed` phone |
| 9 | Remaining fields | Email/Address/Dynamic tasks | Same single-owner pattern per field |
| 10 | Intake done | TaskGroup | `intake_completed`; `intake_active=false` |
| 11 | Availability fetch | Amy tool (still in `start_booking`) | `availability_started` → `get_availability` HTTP → `availability_succeeded` |
| 12 | Slots offered | Amy | Tool return with `linesForModel`; log `slots_offered` |
| 13 | Caller picks slot | Amy | `select_slot` → `slot_selected` |
| 14 | Caller confirms | Amy | `confirm_booking` → `booking_write_started` |
| 15 | Calendly write | TS bridge | `handlers.ts` → `commitBookingForPython` → `writeBookingToProvider` |
| 16 | Receipt + status | TS bridge | Prisma `voiceCall` update → `receipt_persisted` |
| 17 | Confirmation audio | Amy session | `session.say(confirmationSpeech)`; log `booking_write_succeeded` |
| 18 | No model repeat | Amy tool return | Silent instruction string |

**Must NOT appear in logs:** `record_current_field`, `collection_force_skipped_not_awaiting`, `create_response` flipping, duplicate `field_completed` for same field, 20–30s mystery generations.

---

## Smoke test checklist (narrow scope)

Deploy with `VOICE_RUNTIME_IMPL=python`. Run **5–10** calls including slow phone.

1. Problem description → booking intent
2. Name → phone (slow) → remaining required fields
3. Availability → slot offer → selection → explicit confirm
4. Real Calendly booking + receipt in `voiceCall.metadata.pythonBookingReceipt`

Expected log event sequence (JSON `event` field):

```
worker_ready
intent_selected (intent=booking)
task_group_started
task_started → field_completed (per field)
intake_completed
availability_started → availability_succeeded
slots_offered
slot_selected
booking_write_started → booking_write_succeeded
receipt_persisted
```

Rollback: `VOICE_RUNTIME_IMPL=typescript`

**Do not test yet:** transfer, FAQ depth, leave-message DB, cancel/reschedule, real-estate, outbound.

---

## Files touched by audit fixes

| File | Change |
|------|--------|
| `workflows/booking_intake.py` | Gate extraction; async persist; `task_started` logging |
| `session/inbound.py` | Gate transcript listener; `worker_ready` |
| `agent/tools.py` | Availability/slot telemetry; silent confirm return |
| `userdata.py` | `intake_active` flag |
| `handlers.ts` | `receiptPersisted` + bridge log |
| `tests/test_field_mapping.py` | Gating unit test |

---

## Verdict

**Ready for narrow smoke deployment** after this audit lands — **not** ready for general production or "rewrite complete" declaration.

Phase 1–3 foundation is directionally correct. Success criterion: boring repeatable real booking through Python with clean logs on 5–10 calls.
