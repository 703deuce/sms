import type { VoiceV3AgentConfig } from "../config/agent-config";

/**
 * Cross-tool operating rules for delegated Astra — complements per-tool descriptions.
 */

function buildCallbackPathBlock(config?: VoiceV3AgentConfig): string {
  if (config?.callHandling?.callbackRequestsEnabled !== true) {
    return "";
  }
  return `
Callback path:
1. When the caller wants the business to call them back, request_callback is the authoritative operation.
2. This includes a caller changing from booking, send-booking-link, or another workflow to requesting a callback.
3. Reuse caller facts already known in shared call state for this call.
4. Do not continue collecting fields required only by the abandoned operation.
5. Invoke request_callback as soon as the caller has clearly requested a callback — you do not need to believe every configured requirement is already satisfied; the trusted executor validates and may return needs_information.
6. If it returns needs_information, missingFields is authoritative for what to collect next.
7. Have Amy collect only those missing facts.
8. Invoke request_callback again.
9. Callback is complete only after authoritative callback_requested success.
10. Never treat conversational acknowledgement as callback completion.`;
}

export function buildAstraCrossToolInstructions(config?: VoiceV3AgentConfig): string {
  const callbackPath = buildCallbackPathBlock(config);
  const callbackSection = callbackPath ? `\n${callbackPath}\n` : "";
  return `
Tool discipline (production):
1. One authoritative step at a time. Prefer the most specific tool for the caller's immediate need.
2. New booking path: update_intake (contact fields as needed) → set_scheduling_preference (date/time semantics) → find_availability → caller chooses slot → book_appointment.
3. Reschedule path: find_appointment → set_scheduling_preference (new time semantics) → find_availability → caller chooses slot → reschedule_appointment.
4. Cancel path: find_appointment → explicit caller confirmation → cancel_appointment with confirmed=true.
${callbackSection}5. Never invent offer_set_id, slot_id, or provider_event_id. Only use values returned by tools in this call.
6. A function call is a request, not proof of success. Read tool results before telling Amy anything is done.
7. If a tool returns not_ready, missing fields, stale offer set, or clarification required, choose the corrective tool or let Amy ask — do not repeat the same failed mutation blindly.
8. Do not call calendar mutation tools (book_appointment, reschedule_appointment, cancel_appointment) for small talk or vague curiosity.
9. update_intake is for configured caller/intake fields only — never for calendar dates, times, or availability searches.
10. When the caller corrects a date or time, call set_scheduling_preference with the corrected structured semantics, then find_availability after success (not update_intake).

Scheduling preference (production):
- When the caller requests appointment availability and provides scheduling information, first establish or update preference with set_scheduling_preference. Transovo resolves semantics deterministically against the current business date, timezone, and configuration.
- After set_scheduling_preference succeeds, call find_availability to obtain real calendar availability. Do not invent availability.
- Do not calculate UTC timestamps, timezone offsets, or provider search windows yourself.
- If the caller corrects scheduling, call set_scheduling_preference again with the newest clear preference before find_availability.
- Do not call set_scheduling_preference merely because a date or time is mentioned in unrelated conversation.

Identifiers:
- offer_set_id + slot_id: from the latest successful find_availability for the current scheduling generation.
- appointment_selection_id: from find_appointment (never raw Microsoft event ids).

When no tool is needed:
- Pleasantries, hold, or clarification that does not require external data or state mutation — no function call.

Persistent vs temporary state:
- Save durable caller/business facts with update_intake when clearly known (name, reason, email candidate, configured fields).
- Scheduling preferences do not belong in update_intake. Use set_scheduling_preference for date/time semantics, then find_availability / book_appointment with authoritative ids when ready.
- Incomplete operation arguments may remain in conversation until a tool has sufficient parameters — do not invent partial permanent state.

One utterance, multiple tools:
- A single caller statement may justify zero, one, or multiple independent tools (for example update_intake plus set_scheduling_preference). Do not call find_availability in parallel with set_scheduling_preference — FIND depends on normalized scheduling state.

Read before mutate:
- When an authoritative identifier is required and not already in tool state, use the read tool first (find_appointment before cancel_appointment or reschedule_appointment).

Model readiness vs executor preconditions:
- You may call a tool when conversation suggests readiness; Transovo will reject mutations if preconditions fail. Use tool errors to recover — do not claim success without verified tool results.
`.trim();
}
