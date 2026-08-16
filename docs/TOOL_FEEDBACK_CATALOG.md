# Tool feedback catalog

Every tool surface returns **TOOL_FEEDBACK** to the model:

```
TOOL_FEEDBACK: <outcome>
tool: <name>
recovery_class: <optional>
reason: <optional>
field_id / field_label: <optional>
next_action: <always present>
guidance: <what to say / do>
context: <optional JSON>
```

**Outcomes:** `success` | `recoverable_failure` | `terminal_failure`

**Source of truth:** `src/lib/voice/tool-feedback/index.ts`, LiveKit tools under `voice-runtime/src/frontdesk/`, gateway under `src/lib/voice/agent-tool-gateway/`, Telnyx builtins in `src/lib/voice/tools/builtin-actions.ts`.

---

## Speech rules (constitution)

From `transovo-receptionist-constitution.ts`:

- **One complete thought per turn** — do not stack multiple ideas.
- **Exactly one question per turn** — never combine birthday + time + phone + address in one breath.
- Callers may volunteer multiple fields; capture immediately with `record_receptionist_field` / intake tools.
- **Always follow `next_action_meaning` and `guidance`** from TOOL_FEEDBACK — there is always a next step.

**Prompt injection:** The full `next_action` vocabulary is compiled into every receptionist prompt via `buildToolFeedbackVocabularyForPrompt()`. Each tool result also echoes `next_action_meaning` on that specific feedback line.

---

## `next_action` vocabulary

| `next_action` | Meaning for the model |
|---------------|----------------------|
| `continue_conversation` | Default success path — answer briefly, one thought, one question if needed |
| `do_not_speak` | Runtime/task owns speech (collection/intake active); wait silently |
| `offer_slots_and_confirm` | Offer 2–3 times from slot list; ask which time works (one question) |
| `list_slots_then_retry` | Call `list_available_slots` / `calendar_availability`, then offer times |
| `schedule_appointment_retry` | Call `schedule_appointment` with `slot_id` (requirements satisfied) |
| `collect_email_then_retry` | Ask for email (one question), `record_booking_email`, retry booking tool |
| `collect_field_then_retry` | Ask for one missing field, persist, retry same tool |
| `collect_booking_requirements` | Run booking intake for all missing booking fields |
| `record_field_then_retry` | Persist field via `record_receptionist_field`, retry |
| `retry_same_tool` | Brief provider glitch — retry the same tool once |
| `check_booking_status` | Booking write in progress — tell caller to hold, then recheck |
| `take_message` | Offer callback / structured message |
| `end_call` | Booking/transfer complete — brief farewell when caller is done |
| `none` | **Deprecated** — replaced by explicit actions above; should not appear on new paths |

---

## Global gateway error matrix

Applies to **gateway-routed tools** (`calendar_availability`, `book_appointment`, `hold_appointment_slot`, `release_appointment_hold`, `find_appointments`, `reschedule_appointment`, `cancel_appointment`, `send_sms`) and any path using `toolFeedbackFromError` / `translateError`.

| `error_code` | `recovery_class` | `next_action` | Typical `guidance` / speak |
|--------------|------------------|---------------|----------------------------|
| `MISSING_REQUIRED_FIELD` | `MISSING_INFORMATION` | `collect_field_then_retry` | Missing field message from provider |
| `INVALID_INPUT` | `INVALID_INFORMATION` | `collect_field_then_retry` (or `list_slots_then_retry` for `schedule_appointment`) | Validation message |
| `SLOT_NOT_IN_AVAILABILITY` | `INVALID_INFORMATION` | `list_slots_then_retry` for schedule; else `collect_field_then_retry` | "That time is not available. Please choose one of the times I offered." |
| `SLOT_UNAVAILABLE` | `RESOURCE_UNAVAILABLE` | `list_slots_then_retry` | "That time is no longer available. I can check other openings." |
| `ALREADY_COMPLETED` | `DUPLICATE_OPERATION` | `end_call` | "That appointment is already confirmed." (success-shaped) |
| `TEMPORARY_PROVIDER_ERROR` | `TEMPORARY_PROVIDER_ERROR` or `RATE_LIMITED` | `retry_same_tool` | Brief scheduling issue / rate limit — retry or message |
| `AUTH_REQUIRED` | `AUTH_ERROR` | `take_message` | "Calendar connection needs attention. I can take a message for the team." |
| `POLICY_BLOCKED` | `PERMISSION_ERROR` | `take_message` | Policy / approval message |
| `CUSTOMER_NOT_FOUND` | `RESOURCE_UNAVAILABLE` | `take_message` | Customer lookup failed |
| `INTERNAL_ERROR` | `UNKNOWN_FAILURE` | `take_message` | "Something went wrong on my end. I can try again or take a message." |

**Calendly-specific overrides** (`toolFeedbackFromBookingWriteError`):

| Condition | `next_action` | `guidance` |
|-----------|---------------|------------|
| Missing email | `collect_email_then_retry` | Ask naturally for email; `record_booking_email`; retry |
| Missing other field | `collect_field_then_retry` | Ask for that field only |
| Slot taken / stale | `list_slots_then_retry` | Offer fresh slots; do not claim confirmed |

---

## LiveKit receptionist tools (Amy / +18663464256 path)

Production agent uses **Generic Receptionist** on LiveKit with tools from `buildReceptionistTools()` + `buildFrontDeskBookingTools()`.

### Calendar & booking

| Tool | Success `next_action` | Success guidance (summary) |
|------|----------------------|----------------------------|
| `get_current_time` | `continue_conversation` | Use clock for relative dates; one thought at a time |
| `list_available_slots` | `offer_slots_and_confirm` (or `continue_conversation` if empty) | Offer 2–3 times; ask which works; then `schedule_appointment` |
| `schedule_appointment` | `end_call` | Booking confirmed — tell caller they're set |
| `schedule_appointment` (already booked) | `end_call` | Duplicate — already confirmed |
| `record_booking_email` | `schedule_appointment_retry` or `continue_conversation` | Email saved; retry schedule if slot pending |
| `decline_booking_email` | `take_message` | Caller declined email — message or callback |
| `check_booking_status` (confirmed) | `end_call` | Tell caller they're all set |
| `collect_booking_requirements` (complete) | `schedule_appointment_retry` | All requirements satisfied |
| `collect_booking_requirements` (in progress op) | `check_booking_status` | Booking write finishing |
| `collect_booking_requirements` (intake running) | `do_not_speak` | Intake owns speech |
| `collect_booking_requirements` (already satisfied) | `schedule_appointment_retry` | Call schedule with slot_id |
| `cancel_appointment` (success) | `continue_conversation` | Cancellation spoken — ask if anything else |
| `reschedule_appointment` (success) | `end_call` | New time confirmed (same as booking complete) |
| `find_appointments` | via gateway → `continue_conversation` | Help caller pick appointment |

| Tool | Error / partial | `next_action` | Guidance |
|------|-----------------|---------------|----------|
| `list_available_slots` | Provider error | From gateway matrix | Retry or message |
| `schedule_appointment` | Booking in progress | `check_booking_status` | Finishing booking — don't double-call |
| `schedule_appointment` | Invalid/stale `slot_id` | `list_slots_then_retry` | Fresh slots |
| `schedule_appointment` | Missing email/field | `collect_email_then_retry` / `collect_field_then_retry` | One field at a time |
| `schedule_appointment` | Slot unavailable | `list_slots_then_retry` | Failure may already spoken |
| `cancel_appointment` | `confirmed=false` | `continue_conversation` | One confirmation question |
| `reschedule_appointment` | `confirmed=false` | `continue_conversation` | Confirm new time |
| `reschedule_appointment` | Invalid slot | `list_slots_then_retry` | Re-list slots |
| `reschedule_appointment` | Missing email | `collect_email_then_retry` | Email for invite |
| `check_booking_status` | Writing calendar | `check_booking_status` | Hold — recheck |
| `check_booking_status` | Missing email | `collect_email_then_retry` | Need email |
| `check_booking_status` | Failed op | `list_slots_then_retry` | Not booked — offer slots or message |
| `check_booking_status` | Not found | `list_slots_then_retry` | No appointment on call yet |
| Calendar guard (any calendar tool during write) | `check_booking_status` | Booking in progress |

### Caller fields & messages

| Tool | Success `next_action` | Notes |
|------|----------------------|-------|
| `record_receptionist_field` | `continue_conversation` / `schedule_appointment_retry` / `list_slots_then_retry` | Depends on pending slot & time change |
| `collect_caller_fields` (complete) | `schedule_appointment_retry` or `continue_conversation` | Service intake — not for booking/message |
| `collect_caller_fields` (partial) | `do_not_speak` | Collection task owns speech |
| `collect_caller_fields` (booking purpose) | Same as `collect_booking_requirements` | Redirects to intake |
| `collect_caller_fields` (booking in progress) | `check_booking_status` | |
| `collect_caller_fields` (slot pending) | `collect_booking_requirements` | Use booking intake, then schedule |
| `take_message` | `continue_conversation` | Confirm once; one follow-up question max |
| `send_sms` | `continue_conversation` | Gateway success mapping |

| Tool | Error | `next_action` | Guidance |
|------|-------|---------------|----------|
| `record_receptionist_field` | Empty value | `collect_field_then_retry` | Ask for that field only |
| `record_receptionist_field` | Validation | `collect_field_then_retry` | Re-ask naturally |
| `record_receptionist_field` | Invalid email | `collect_email_then_retry` | Say email again slowly |
| `take_message` | Missing reason/name/phone | `collect_field_then_retry` | **One** question for missing piece |
| `send_sms` | No phone | `collect_field_then_retry` | Ask number to text |
| `collect_caller_fields` (purpose=message) | redirect string | `continue_conversation` | Use `take_message` |

### Transfer & knowledge

| Tool | Success `next_action` | Guidance |
|------|----------------------|----------|
| `transfer_to_human` | `end_call` | Stay silent after bridge — transfer in progress |
| `get_business_answer` | `continue_conversation` | One concise answer from lookup |

| Tool | Error | `next_action` | Guidance |
|------|-------|---------------|----------|
| `transfer_to_human` | No destination | `take_message` or `continue_conversation` | Transfer not configured |
| `transfer_to_human` | Transfer failed (busy/no answer) | `take_message` or `continue_conversation` | Offer message |
| `transfer_to_human` | No transfer path | `take_message` or `continue_conversation` | Can't transfer this call |
| `get_business_answer` | Lookup failed | From gateway / `take_message` | |

### Call end

| Tool | Success `next_action` |
|------|----------------------|
| `end_call` | `end_call` (farewell then hangup) |

---

## Telnyx builtin webhook tools (`/api/telnyx/voice/tools`)

Enabled per agent from `TOOL_CATALOG` / `BUILTIN_WEBHOOK_BODIES`. Responses include `speak` + `tool_feedback` when routed through gateway envelope.

| Tool key | Success `next_action` (via gateway/feedback) | Primary errors |
|----------|---------------------------------------------|----------------|
| `calendar_availability` | `offer_slots_and_confirm` | Gateway matrix; empty slots → continue + widen window |
| `book_appointment` | `end_call` | Missing fields, slot errors, auth, policy |
| `hold_appointment_slot` | `schedule_appointment_retry` | Slot unavailable |
| `release_appointment_hold` | `continue_conversation` | Hold not found |
| `find_appointments` | `continue_conversation` | No appointments / phone required |
| `reschedule_appointment` | `continue_conversation` | Same as LiveKit reschedule |
| `cancel_appointment` | `continue_conversation` | Appointment not found |
| `send_sms` | `continue_conversation` | Missing to/body, SMS integration |
| `lookup_customer` | `continue_conversation` | Not found → continue without inventing |
| `search_crm_contacts` | `continue_conversation` | Ambiguous → one clarifying question |
| `create_crm_note` | `continue_conversation` | CRM auth / not found |
| `create_crm_task` | `continue_conversation` | CRM errors |
| `upsert_crm_contact` | `continue_conversation` | Validation / CRM errors |
| `create_task` | `continue_conversation` | Missing title |
| `take_structured_message` | `continue_conversation` | Missing reason |
| `mark_disposition` | `continue_conversation` | Invalid disposition |
| `save_collected_fields` / `record_current_field` | `continue_conversation` or workflow-driven | Wrong workflow state |
| `continue_workflow` | Workflow engine speak + next step | Illegal action for state |
| `get_workflow_requirements` | `continue_conversation` | Ask only `missing_fields` |
| `get_runtime_context` | `continue_conversation` | Trust returned allowed tools |
| `resolve_datetime` | `continue_conversation` | Unparseable phrase → re-ask once |
| `escalate_human` | `end_call` on success | Same as transfer failures |
| `sip_refer` | `end_call` | SIP misconfiguration |
| `send_dtmf` | `continue_conversation` | Invalid digits |
| `send_email` | `continue_conversation` | Missing fields / send failure |
| `start_automation` | `continue_conversation` | Flow not found |
| `end_call` | `end_call` | |
| `runtime_turn` | Workflow-dependent | Retired on LiveKit agents |

**Route-level failures** (no tool execution):

| Condition | `speak` to agent |
|-----------|----------------|
| Missing workspace | "I'm having trouble looking that up. Can I take a message instead?" |
| Agent not found | "I'm not able to do that right now." |
| LiveKit-only agent | "This line uses our LiveKit voice system…" |
| Legacy tool retired | "I'm not able to do that on this line right now." |
| Unknown tool | "I'm not sure how to do that. Can I take a message?" |

---

## Native Telnyx tools

| Tool | Model-facing behavior | `next_action` equivalent |
|------|----------------------|--------------------------|
| `hangup` | Ends call after closing line | `end_call` |
| `transfer` | Named destination only | `end_call` on success; `take_message` on failure |
| `handoff` | Switch AI assistant | `continue_conversation` with new assistant |

---

## Normalization layer (`normalizeToolResultForModel`)

Legacy string returns are wrapped automatically:

| Input pattern | Outcome | `next_action` |
|---------------|---------|---------------|
| `COLLECT_ACTIVE_SILENT` / intake silent | success | `do_not_speak` |
| `COLLECTION_PARTIAL` / `BOOKING_INTAKE_PARTIAL` | recoverable | `do_not_speak` |
| `COLLECTION_COMPLETE` | success | `schedule_appointment_retry` if mentions schedule; else `continue_conversation` |
| `BOOKING_INTAKE_COMPLETE` | success | `schedule_appointment_retry` |
| `already_completed:` | success | `end_call` |
| `BOOKING_COMPLETE_*` | success | `end_call` |
| `BOOKING_FAILED_ALREADY_SPOKEN` | recoverable | `list_slots_then_retry` |
| Empty string | recoverable | `take_message` |
| "Use take_message…" redirects | recoverable | `continue_conversation` |
| Plain success text | success | `continue_conversation` |

---

## Maintenance

When adding a tool:

1. Return `formatToolFeedbackForModel(...)` — never raw strings (except legacy Telnyx `speak` + envelope).
2. Set explicit `next_action` on every branch — default success is `continue_conversation`.
3. Use `do_not_speak` when a nested task speaks for the agent.
4. Update this catalog and run `npx tsx scripts/test-tool-feedback.ts`.
