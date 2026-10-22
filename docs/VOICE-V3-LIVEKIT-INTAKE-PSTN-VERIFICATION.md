# Voice V3 — LiveKit-native intake PSTN verification

Use after **matching** web + Python worker + republished Full Receptionist agent. One controlled call; no architecture changes if this fails — use traces to localize.

## Deploy order

1. Deploy **new-app** (Node) with `collect_caller_intake` schema (`volunteered_values`, `caller_turn_hint`).
2. Redeploy **voice-runtime-python** worker (intake bridge, `IntakeTask`, chat context).
3. **Republish** Full Receptionist so the published agent exposes `collect_caller_intake` and **not** `update_intake`, `set_intake_*`, or `collect_intake_field`.

## Single-call script

1. Call the receptionist PSTN number.
2. In **one** statement, provide configured intake fields, e.g. name, email, phone, and one **custom** wizard field (e.g. favorite dinosaur).
3. Ask to **book an appointment** (same or next turn).
4. Complete availability selection and confirm booking.

## Success criteria

- `collect_caller_intake` appears in tool traces with `volunteered_values` covering the facts you spoke.
- Node intake state shows all fields saved; correcting email updates only email on a later turn.
- **No** repeated questions for facts already supplied.
- Booking completes using saved intake (calendar event / confirmation matches contact details).

## Failure isolation (log / trace fields)

| Symptom | Likely layer | What to inspect |
|--------|----------------|-----------------|
| Booking proceeds but contact fields empty | Luna never called intake | Delegation tool list; prompt; whether `find_availability` ran before `collect_caller_intake` |
| Tool called but fields wrong | `volunteered_values` extraction | Tool args JSON; Node validation errors on `update_intake` |
| `persisted_volunteered_only` missing but task started | Fast path not taken | `get_intake_state` `missing_required_fields` after persist |
| Task re-asks for known email | Context | `voice_v3_intake_chat_ctx_*` logs; whether `caller_turn_hint` was used; `session.history` vs hint duplicate skip |
| Phone/email wrong after clarify | Nested collector | `clarify_field_using_livekit` + real `GetPhoneNumberTask` / `GetEmailTask` (not mocked) |
| Intake OK, booking fails | Scheduling engine | `find_availability` / `book_appointment` traces (unchanged engine) |

### Python worker log markers

- `voice_v3_collect_caller_intake_fast_path` — batch persist starting
- `voice_v3_collect_caller_intake_task_start` — `IntakeTask` launched
- `data.persisted_volunteered_only` in tool result — no spoken questionnaire
- `voice_v3_intake_chat_ctx_hint_appended` vs `hint_skipped_duplicate`

## Policy reminders

- **`volunteered_values`:** only configured field keys; Node `validateAndNormalizeIntakeValue` is authoritative.
- **`caller_turn_hint`:** verbatim caller/ASR text only when history lags; omit if unsure. Structured facts belong in `volunteered_values`, not a paraphrased hint.

## Out of scope for this checklist

- Conversational IVR capability restrictions (separate product gate).
- Mass PSTN regression matrix — one happy-path booking after intake is sufficient to gate this rewrite.
