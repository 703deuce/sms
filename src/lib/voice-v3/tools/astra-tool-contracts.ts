/**
 * Production OpenAI function-tool contracts for delegated Astra (Voice V3).
 * Descriptions + parameter semantics are part of the runtime interface — keep in sync with execute behavior.
 */

export const UPDATE_INTAKE_TOOL_DESCRIPTION = `
Save caller-provided identity and business intake fields into authoritative call state.

WHEN TO CALL:
- Caller gives or corrects configured intake fields (name, email, phone, etc.).
- Caller states a high-level goal that should be recorded (book, reschedule, cancel, callback, transfer) via active_goal when no other tool is more specific.

WHEN NOT TO CALL:
- Caller asks what times are open or available → find_availability.
- Caller gives date/time preferences for scheduling or availability → find_availability (not this tool).
- Caller wants to book a specific offered slot → book_appointment.
- Caller wants to locate, change, or cancel an existing appointment → find_appointment first; then reschedule_appointment or cancel_appointment as appropriate.
- Caller only chatting with no intake or scheduling request → no tool.

SIDE EFFECTS:
- Merges provided field values into authoritative intake state.
- May update dialog active_goal when provided.
- Does NOT query Microsoft calendar, search availability, book, reschedule, cancel, transfer, or end the call.
- Tool success does not mean the caller heard confirmation — Amy speaks via GPT-Live.

SUCCESS:
- Returns updated_fields and still_required; use still_required before booking.
`.trim();

export const FIND_AVAILABILITY_TOOL_DESCRIPTION = `
Search Microsoft calendar for real appointment slots matching the caller's requested window.

WHEN TO CALL:
- Caller wants to know what times are available (new booking or new time for a reschedule after the existing appointment is verified).
- Caller changes date/time preference (correction) for an availability search.

WHEN NOT TO CALL:
- Caller only provides name/email/phone → update_intake.
- Caller selects a slot from a presented offer set → book_appointment or reschedule_appointment.
- Caller wants to find an existing appointment record → find_appointment.
- Caller confirms cancellation → cancel_appointment (after find_appointment).

SIDE EFFECTS:
- Normalizes scheduling language, may bump scheduling_generation, runs FIND against Microsoft.
- Does NOT book, reschedule, cancel, or mutate an existing event.
- Returns offer_set_id and slot_id values — use only IDs from this result; never invent IDs.

SUCCESS:
- status available with slots, or none_available, or structured error (clarification required, failed).
`.trim();

export const BOOK_APPOINTMENT_TOOL_DESCRIPTION = `
Create a new calendar appointment for the caller on a slot from the current offer set.

WHEN TO CALL:
- Caller clearly chose one offered slot (ordinal or explicit time matching an offered slot_id).
- Required intake is complete and find_availability returned a current offer_set_id.

WHEN NOT TO CALL:
- No offer set yet or caller has not chosen a slot → find_availability first.
- Caller is changing an existing appointment → find_appointment, then find_availability, then reschedule_appointment.
- Caller only asked availability without committing to a slot.

SIDE EFFECTS:
- Binds selection, runs BOOK in Microsoft Graph when ready.
- Calling is not success — only tool result status confirmed means booked.

PARAMETERS:
- offer_set_id and slot_id must come from the latest find_availability result for this call.
`.trim();

export const FIND_APPOINTMENT_TOOL_DESCRIPTION = `
Locate the caller's existing appointment in Microsoft calendar before reschedule or cancel mutations.

WHEN TO CALL:
- Caller wants to reschedule, cancel, or discuss an existing appointment and the record is not yet verified in this call.
- Before cancel_appointment or reschedule_appointment.

WHEN NOT TO CALL:
- Caller only wants new availability for a brand-new booking → find_availability.
- Caller already confirmed which slot to book from offers → book_appointment.
- Caller confirmed cancellation and appointment already verified this call → cancel_appointment.

SIDE EFFECTS:
- Read-only lookup; may set verifiedExisting on success.
- Does NOT cancel, reschedule, or create events.

SUCCESS:
- found, ambiguous (multiple matches), or structured not_found / verification errors.
`.trim();

export const RESCHEDULE_APPOINTMENT_TOOL_DESCRIPTION = `
Move a verified existing appointment to a new slot from the current offer set.

WHEN TO CALL:
- find_appointment succeeded (verified existing) AND find_availability returned offers AND caller chose the new slot.

WHEN NOT TO CALL:
- Existing appointment not verified → find_appointment.
- No current offer set or slot choice → find_availability.
- Brand-new booking → book_appointment.

SIDE EFFECTS:
- Mutates Microsoft calendar when tool result confirms rescheduled.
- offer_set_id and slot_id must be from the latest find_availability; provider_event_id should match verified appointment when provided.
`.trim();

export const CANCEL_APPOINTMENT_TOOL_DESCRIPTION = `
Cancel a verified existing appointment after explicit caller confirmation.

WHEN TO CALL:
- find_appointment verified the record AND caller clearly confirmed they want to cancel (not merely asked about canceling).

WHEN NOT TO CALL:
- Caller asked to cancel but has not confirmed → do not call; Amy confirms first.
- Appointment not verified → find_appointment.
- Caller is booking new time → find_availability / book_appointment.

SIDE EFFECTS:
- Mutates Microsoft calendar when tool result confirms cancelled.
- confirmed must be true; provider_event_id should match verified appointment when provided.
`.trim();

export const TRANSFER_CALL_TOOL_DESCRIPTION = `
Request transfer of the live call to a human when policy allows.

WHEN TO CALL:
- Caller asks for a person/representative and transfer is appropriate.

WHEN NOT TO CALL:
- Scheduling intake, availability, book, reschedule, cancel can still be handled on the call.
- Caller only said goodbye → end_call may apply instead.

SIDE EFFECTS:
- Requests transfer; success depends on workspace configuration and telephony result.
`.trim();

export const END_CALL_TOOL_DESCRIPTION = `
Signal that the business conversation is complete and the call may end after Amy's closing remarks.

WHEN TO CALL:
- Caller is done, issue resolved, and no further tools are needed.

WHEN NOT TO CALL:
- Caller still scheduling or mid-task.
- Caller asked for a human → transfer_call.

SIDE EFFECTS:
- Does not immediately hang up; GPT-Live owns goodbye wording.
`.trim();

export const ACTIVE_GOAL_ENUM_DESCRIPTION = `
Optional dialog goal label when the caller's stated intent is clear and no more specific tool applies yet.
Use BOOK_APPOINTMENT, RESCHEDULE_APPOINTMENT, CANCEL_APPOINTMENT, REQUEST_CALLBACK, or REQUEST_TRANSFER when stated.
Use null when unknown or unchanged.
`.trim();
