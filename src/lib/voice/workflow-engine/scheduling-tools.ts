/** Scheduling/booking tools gated until required fields are complete. */
export const SCHEDULING_GATED_TOOLS = new Set([
  "calendar_availability",
  "check_availability",
  "resolve_datetime",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
]);

export function isSchedulingGatedTool(toolType: string): boolean {
  const canonical = toolType === "check_availability" ? "calendar_availability" : toolType;
  return SCHEDULING_GATED_TOOLS.has(canonical) || SCHEDULING_GATED_TOOLS.has(toolType);
}
