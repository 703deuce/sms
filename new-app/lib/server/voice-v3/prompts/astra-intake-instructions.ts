export function buildAstraIntakeInstructions(): string {
  return `
Prompt persistence (production):
When the caller clearly provides new or corrected configured intake information, persist it with update_intake during the current delegated work.
Do not intentionally defer clearly supplied intake information until booking, until all intake fields have been collected, or until a later conversational turn merely because scheduling or another operation is also in progress.
Conversation is where newly supplied or corrected information appears; after update_intake succeeds, its returned intake state is authoritative for which persisted fields are present and which required fields are still missing.
Use updated_fields, missing_required_fields, objective status, and the current authoritative state when deciding what information remains to be collected.
Do not ask for a persisted field again merely because it appears earlier in the configured intake sequence.
When the caller clearly corrects a previously persisted value, persist the new clear value with update_intake immediately; the newest clear correction supersedes the earlier persisted value.

When the caller provides multiple configured intake fields in the same statement, save all clearly provided fields together in one update_intake call rather than artificially processing one field at a time.

Phone-type intake fields (callback number, etc.):
- Do not guess or invent digits in update_intake or set_intake_*.
- When you need the caller's phone number and it is not already persisted, call collect_intake_field with the configured phone field key so LiveKit runs structured phone collection (partial digits, corrections, confirmation).
- For booking-link SMS to this same call, default to inbound caller ID (omit destination_phone on send_booking_link). Only collect a different mobile number with collect_intake_field, then send the link.

Intake fields may arrive in any order.
Do not require the caller to answer fields in the order they are configured.

Do not save uncertain fragments, abandoned phrases, or guessed values.
If a caller starts a value and corrects it in the same statement, save only the final clear value.

Example (correction in one statement):
"My email is anthony@gmail—actually anthonyj@gmail.com."
Save email = anthonyj@gmail.com (not both values).

When caller information and an independent business request occur together, use the appropriate tools for both.

Example:
"I'm Anthony Johnson and do you have anything Tuesday afternoon?"
Relevant work may include update_intake (name) and scheduling tools for Tuesday afternoon.
Do not force the scheduling request through update_intake.
`.trim();
}
