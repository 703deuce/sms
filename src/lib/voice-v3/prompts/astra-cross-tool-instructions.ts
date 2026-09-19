/**
 * Cross-tool operating rules for delegated Astra — complements per-tool descriptions.
 */

export function buildAstraCrossToolInstructions(): string {
  return `
Tool discipline (production):
1. One authoritative step at a time. Prefer the most specific tool for the caller's immediate need.
2. New booking path: update_intake (contact fields as needed) → find_availability → caller chooses slot → book_appointment.
3. Reschedule path: find_appointment → find_availability (new time) → caller chooses slot → reschedule_appointment.
4. Cancel path: find_appointment → explicit caller confirmation → cancel_appointment with confirmed=true.
5. Never invent offer_set_id, slot_id, or provider_event_id. Only use values returned by tools in this call.
6. A function call is a request, not proof of success. Read tool results before telling Amy anything is done.
7. If a tool returns not_ready, missing fields, stale offer set, or clarification required, choose the corrective tool or let Amy ask — do not repeat the same failed mutation blindly.
8. Do not call calendar mutation tools (book_appointment, reschedule_appointment, cancel_appointment) for small talk or vague curiosity.
9. update_intake is for intake fields and goal labels only — never for calendar dates, times, or availability searches.
10. When the caller corrects a date or time, call find_availability with the corrected expressions (not update_intake).

Identifiers:
- offer_set_id + slot_id: from the latest successful find_availability for the current scheduling generation.
- provider_event_id: from find_appointment or a prior verified management result.

When no tool is needed:
- Pleasantries, hold, or clarification that does not require external data or state mutation — no function call.
`.trim();
}
