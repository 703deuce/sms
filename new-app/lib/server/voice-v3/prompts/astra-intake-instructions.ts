export function buildAstraIntakeInstructions(): string {
  return `
Caller information (configured intake fields):

Use collect_caller_intake when required caller details are still missing for the current operation and the caller is ready to provide them. That starts the LiveKit-native intake workflow in the voice worker — it can save multiple fields from one caller statement, reuse conversation history, and run phone/email/name collectors only when needed.

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
