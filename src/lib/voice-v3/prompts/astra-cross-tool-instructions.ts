import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";
import { runtimeHasTool } from "./effective-prompt-capabilities";

/**
 * Cross-tool operating rules for delegated Astra — complements per-tool descriptions.
 */

function buildCalendarWorkflowSubsection(config?: VoiceV3AgentConfig): string {
  if (!config || !isDirectCalendarBookingConfig(config)) return "";
  const parts: string[] = [];
  if (runtimeHasTool(config, "book_appointment")) {
    parts.push(
      "Direct calendar booking: persist clearly supplied intake with update_intake when the caller provides it → set_scheduling_preference (date/time semantics) → find_availability → caller chooses slot → book_appointment. FIND may occur while intake is still incomplete; do not require every configured intake field before find_availability unless deterministic policy requires it. Before book_appointment, rely on authoritative intake state and existing booking preconditions.",
    );
  }
  if (runtimeHasTool(config, "reschedule_appointment")) {
    parts.push(
      "Reschedule: find_appointment → set_scheduling_preference (new time semantics) → find_availability → caller chooses slot → reschedule_appointment.",
    );
  }
  if (runtimeHasTool(config, "cancel_appointment")) {
    parts.push(
      "Cancel: find_appointment → explicit caller confirmation → cancel_appointment with confirmed=true.",
    );
  }
  if (parts.length === 0) return "";
  return parts.map((p) => `- ${p}`).join("\n");
}

function buildRequestOnlySubsection(config?: VoiceV3AgentConfig): string {
  if (config?.scheduling?.bookingStrategy !== "REQUEST_ONLY") return "";
  if (!runtimeHasTool(config, "submit_appointment_request")) return "";
  return `- Request-only booking: collect required intake naturally → submit_appointment_request when the caller wants an appointment. Do not call find_availability, set_scheduling_preference, book_appointment, find_appointment, reschedule_appointment, or cancel_appointment — those tools are not registered.`;
}

function buildSendLinkSubsection(config?: VoiceV3AgentConfig): string {
  if (config?.scheduling?.bookingStrategy !== "SEND_LINK") return "";
  if (!runtimeHasTool(config, "send_booking_link")) return "";
  return `- Send booking link: obtain explicit SMS consent with required verbal disclosure → send_booking_link with confirmed=true. Do not use calendar find/book tools for new booking intent.`;
}

function buildCallbackSubsection(config?: VoiceV3AgentConfig): string {
  if (config?.callHandling?.callbackRequestsEnabled !== true) return "";
  return `- Callback: when the caller wants the business to call them back (including pivoting from booking or send-link), request_callback is authoritative. Reuse known call-state facts; do not keep collecting fields required only by an abandoned workflow. Invoke request_callback when the caller has clearly requested a callback — the executor validates and may return needs_information; Amy collects only missingFields, then invoke again. Complete only after authoritative callback_requested success.`;
}

function buildSchedulingPreferenceSubsection(config?: VoiceV3AgentConfig): string {
  if (!config || !runtimeHasTool(config, "set_scheduling_preference")) return "";
  return `
Scheduling preference (when set_scheduling_preference is available):
- When the caller requests appointment availability and provides scheduling information, establish or update preference with set_scheduling_preference. Transovo resolves semantics deterministically against business date, timezone, and configuration.
- Bare weekday names (for example "Monday" on a Friday) → THIS_WEEKDAY for the nearest upcoming that day. Use NEXT_WEEKDAY only when the caller clearly means the following calendar week.
- After set_scheduling_preference succeeds, call find_availability for real calendar availability. Do not invent availability.
- Do not calculate UTC timestamps, timezone offsets, or provider search windows yourself.
- If the caller corrects scheduling, call set_scheduling_preference again before find_availability.
- Do not call set_scheduling_preference merely because a date or time appeared in unrelated conversation.
- offer_set_id + slot_id come from the latest successful find_availability for the current scheduling generation.
- appointment_selection_id comes from find_appointment (never raw provider event ids).
`.trim();
}

export function buildAstraCrossToolInstructions(config?: VoiceV3AgentConfig): string {
  const workflowLines = [
    buildCalendarWorkflowSubsection(config),
    buildRequestOnlySubsection(config),
    buildSendLinkSubsection(config),
    buildCallbackSubsection(config),
  ].filter(Boolean);

  const calendarMutations =
    runtimeHasTool(config, "book_appointment") ||
    runtimeHasTool(config, "reschedule_appointment") ||
    runtimeHasTool(config, "cancel_appointment");

  const schedulingParallel = runtimeHasTool(config, "set_scheduling_preference")
    ? "A single caller statement may justify multiple independent tools (for example update_intake plus set_scheduling_preference). Do not call find_availability in parallel with set_scheduling_preference — FIND depends on normalized scheduling state."
    : "A single caller statement may justify zero, one, or multiple independent tools when each maps to an enabled backend function.";

  const readBeforeMutate = runtimeHasTool(config, "find_appointment")
    ? "When an authoritative identifier is required and not already in tool state, use the read tool first (find_appointment before cancel_appointment or reschedule_appointment)."
    : "";

  const schedulingIntakeSplit = runtimeHasTool(config, "set_scheduling_preference")
    ? "Scheduling preferences do not belong in update_intake. Use set_scheduling_preference for date/time semantics."
    : "";

  return `
1. Tool authority and truth
- One authoritative step at a time. Prefer the most specific enabled tool for the caller's immediate need.
- A function call is a request, not proof of success. Read tool results before telling Amy anything is done.
- Never invent offer_set_id, slot_id, appointment_selection_id, or provider_event_id. Only use values returned by tools in this call.
- update_intake is for configured caller/intake fields only — never for calendar dates, times, or availability searches.

2. Tool selection
- When no tool is needed: pleasantries, hold, or clarification that does not require external data or state mutation — no function call.
- ${schedulingParallel}
${readBeforeMutate ? `- ${readBeforeMutate}` : ""}

3. Caller intent and corrections
- Reason from the caller's newest clear instruction and current authoritative tool state.
- When the caller corrects a date or time and set_scheduling_preference is available, call it with corrected semantics, then find_availability after success (not update_intake).
${calendarMutations ? "- Do not call calendar mutation tools (book_appointment, reschedule_appointment, cancel_appointment) for small talk or vague curiosity." : ""}

4. Intake persistence (with update_intake section above)
- Clearly supplied configured intake should be persisted promptly via update_intake — see Prompt persistence instructions. Do not defer intake to conversation alone because a later mutation might fail.
${schedulingIntakeSplit ? `- ${schedulingIntakeSplit}` : ""}

5. Enabled action workflows
${workflowLines.length > 0 ? workflowLines.join("\n") : "- No booking, callback, or link workflows are enabled beyond general intake and conversation."}

6. Error and unknown outcomes
- If a tool returns not_ready, missing fields, stale offer set, or clarification required, choose the corrective tool or let Amy ask — do not repeat the same failed mutation blindly.
- If a tool returns OUTCOME_UNKNOWN, do not repeat the mutation unless authoritative application state explicitly permits it.
- Executor rejection is not a substitute for prompt intake persistence.

7. Concurrency and stale results
- Current verified application/tool state outranks an earlier conversational assumption.
- Later clear caller corrections outrank earlier caller preferences.

8. Model readiness vs executor preconditions
- You may call a tool when conversation suggests readiness; Transovo will reject mutations if preconditions fail. Use tool errors to recover — do not claim success without verified tool results.

${buildSchedulingPreferenceSubsection(config)}
`.trim();
}
