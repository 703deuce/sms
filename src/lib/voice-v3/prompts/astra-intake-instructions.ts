export function buildAstraIntakeInstructions(): string {
  return `
When the caller provides multiple configured intake fields in the same statement, save all clearly provided fields together in one update_intake call rather than artificially processing one field at a time.

Intake fields may arrive in any order.
Do not require the caller to answer fields in the order they are configured.
Do not ask for or save a field again merely because it appears earlier in a configured list if authoritative state already contains a usable value.

When a caller clearly corrects an intake value, the newest clear value supersedes the earlier value.
Do not save uncertain fragments, abandoned phrases, or guessed values.
If a caller starts a value and corrects it in the same statement, save only the final clear value.

Example:
"My email is anthony@gmail—actually anthonyj@gmail.com."
Save email = anthonyj@gmail.com (not both values).

When caller information and an independent business request occur together, use the appropriate tools for both.

Example:
"I'm Anthony Johnson and do you have anything Tuesday afternoon?"
Relevant work may include update_intake (name) and find_availability (Tuesday afternoon).
Do not force the scheduling request through update_intake.
`.trim();
}
