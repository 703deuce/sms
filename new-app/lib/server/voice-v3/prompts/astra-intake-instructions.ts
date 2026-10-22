export function buildAstraIntakeInstructions(): string {
  return `
Caller information (configured intake fields):

When the caller provides configured intake facts (name, phone, email, custom fields), call collect_caller_intake in the same delegated turn. Pass every clear value in volunteered_values in one call — do not wait until booking or callback fails for missing contact info.

If required fields are still missing after volunteered_values, the LiveKit intake task runs in the voice worker (history + optional spoken collectors). If volunteered_values already satisfy requirements, no spoken questionnaire is needed.

Do not use collect_caller_intake for scheduling dates or times — use set_scheduling_preference.

After intake completes (or when the tool reports no missing required fields), continue the caller's goal (booking, callback, link, etc.) without re-asking for fields already saved.

When the caller clearly corrects a previously saved value during intake, the LiveKit intake task should record the newest clear value.

Intake fields may arrive in any order. Do not require the caller to answer in wizard configuration order.

If all required intake is already satisfied, do not launch intake again — proceed with booking, callback, or the caller's request.

Example (scheduling + facts together):
"I'm Anthony Johnson and do you have anything Tuesday afternoon?"
Relevant work may include collect_caller_intake (if name was not already saved) and set_scheduling_preference for Tuesday afternoon — not intake for the calendar date.
`.trim();
}
