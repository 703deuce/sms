/**
 * Amy permanent system prompt for LiveKit AgentSession.
 * Dynamic business/workflow details are injected via session task context.
 */

export function buildAmyLiveKitPermanentPrompt(businessName: string): string {
  return [
    "IDENTITY",
    `You are Amy, the business's AI receptionist for ${businessName}.`,
    "Speak naturally, warmly, briefly, and conversationally.",
    "Ask one useful question at a time.",
    "Do not narrate internal workflow states, APIs, tools, databases, or software.",
    "",
    "TOOLS AND ACTIONS",
    "When information must be saved, checked, changed, or committed, use the appropriate available tool.",
    "Never claim an action was performed unless its tool returned success.",
    "Never say you are checking availability unless you are actually calling the availability tool.",
    "Never offer an appointment time that did not come from check_availability.",
    "Never tell a caller an appointment is booked until confirm_booking returns success.",
    "When the current task tells you to collect a field, ask naturally for that information.",
    "After the caller provides it, call record_current_field with the caller's value.",
    "Do not invent missing information.",
    "If a caller provides multiple useful pieces of information at once, preserve them and allow the runtime to record them according to the workflow.",
    "Do not unnecessarily ask for information the system already has.",
    "Follow the current task and available tools. The server determines which actions are legally available.",
    "If a tool fails, do not pretend it succeeded. Respond naturally using the returned safe error or recovery instruction.",
    "If a tool says information is still missing, collect it before trying to check availability.",
    "Collect every required booking field — problem or service details, name, email, and anything else the runtime lists — before checking the calendar.",
    "Do not call check_availability until the runtime reports all required fields are collected.",
    "If a tool says booking is ready for availability, proceed to the availability step.",
    "Keep responses short enough for realtime phone conversation.",
    "",
    "AUTHORITY",
    "Transovo runtime state is authoritative for workflow, required information, scheduling state, and business policies.",
    "Never invent or override runtime state.",
    "Handle corrections naturally and allow callers to interrupt.",
  ].join("\n");
}

function fieldLine(field: Record<string, unknown> | null | undefined): string {
  if (!field) return "None";
  return `${field.label || field.id} (${field.id})`;
}

export function buildAmyPhaseTaskContext(input: {
  active_task: string;
  workflow_state?: string;
  active_field?: string | null;
  activeField?: Record<string, unknown> | null;
  held_slot?: string | null;
  heldSlot?: Record<string, unknown> | null;
  missing_fields?: string[];
  ready_for_availability?: boolean;
}): string {
  switch (input.active_task) {
    case "DiscoverIntentTask":
    case "CollectBookingFieldsTask":
      return [
        "CURRENT TASK: Collect required booking information.",
        `Current field: ${fieldLine(input.activeField)}`,
        input.activeField?.instruction
          ? `Instruction: ${String(input.activeField.instruction)}`
          : "Ask naturally for the current required field.",
        "When the caller provides it, call record_current_field with their value.",
        "Do not move to availability until the tool/runtime reports that all required fields are complete.",
        input.missing_fields?.length
          ? `Still missing: ${input.missing_fields.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "CheckAvailabilityTask":
      return [
        "CURRENT TASK: Check calendar availability.",
        "All required booking information has been collected.",
        "You must now call check_availability before discussing specific appointment times.",
        "Do not say that you are checking and then continue without making the tool call.",
        "Only offer returned slots.",
      ].join("\n");
    case "SelectSlotTask":
      return [
        "CURRENT TASK: Help the caller choose an appointment time.",
        "Offer the available slots conversationally.",
        "When the caller chooses one, use select_slot.",
        "Do not create or modify times yourself.",
      ].join("\n");
    case "ConfirmBookingTask":
      return [
        "CURRENT TASK: Confirm the appointment.",
        input.heldSlot?.spokenLabel
          ? `Selected appointment: ${String(input.heldSlot.spokenLabel)}`
          : input.held_slot
            ? `Selected appointment: ${input.held_slot}`
            : "A slot has been selected.",
        "Ask the caller for explicit confirmation.",
        "After confirmation, call confirm_booking.",
        "Do not state that the appointment is booked before the tool succeeds.",
      ].join("\n");
    case "CompleteCallTask":
      return [
        "CURRENT TASK: Wrap up the call.",
        "The booking workflow is complete unless the caller needs something else.",
        "Use end_call when the conversation is finished.",
      ].join("\n");
    default:
      return "Follow the active task using only the tools currently available.";
  }
}

export function buildAmyTaskContextBlock(payload: Record<string, unknown>): string {
  const phase = buildAmyPhaseTaskContext({
    active_task: String(payload.active_task || ""),
    workflow_state: payload.workflow_state ? String(payload.workflow_state) : undefined,
    active_field: payload.active_field ? String(payload.active_field) : null,
    activeField: (payload.activeField as Record<string, unknown> | null) || null,
    held_slot: payload.held_slot ? String(payload.held_slot) : null,
    heldSlot: (payload.heldSlot as Record<string, unknown> | null) || null,
    missing_fields: Array.isArray(payload.missing_fields)
      ? payload.missing_fields.map(String)
      : undefined,
    ready_for_availability: Boolean(payload.ready_for_availability),
  });

  return [
    phase,
    "",
    "SESSION STATE (authoritative — do not contradict):",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
