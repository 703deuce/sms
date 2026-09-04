/**
 * Entitlement-ready capability keys for appointment workflows and AI booking.
 * Not wired to billing yet — use for future plan gating.
 */
export const APPOINTMENT_CAPABILITY_KEYS = {
  defaultReminderWorkflow: "appointments.workflow.default_reminders",
  customWorkflowTiming: "appointments.workflow.custom_timing",
  customWorkflowCreation: "appointments.workflow.custom_create",
  customTemplates: "appointments.workflow.custom_templates",
  multipleWorkflows: "appointments.workflow.multiple",
  aiNaturalLanguageBooking: "appointments.ai.booking",
  aiConversationalReschedule: "appointments.ai.reschedule",
  multiStaff: "appointments.scheduling.multi_staff",
  roundRobin: "appointments.scheduling.round_robin",
  collectiveScheduling: "appointments.scheduling.collective",
  recurringAppointments: "appointments.scheduling.recurring",
  groupBookings: "appointments.scheduling.group",
  payments: "appointments.scheduling.payments",
  googleCalendarSync: "appointments.scheduling.google_calendar",
  waitlist: "appointments.scheduling.waitlist",
  multipleLocations: "appointments.scheduling.locations",
  customBookingQuestions: "appointments.scheduling.booking_questions",
  advancedWorkflows: "appointments.workflow.advanced",
} as const;

export type AppointmentCapabilityKey =
  (typeof APPOINTMENT_CAPABILITY_KEYS)[keyof typeof APPOINTMENT_CAPABILITY_KEYS];

/** Default: all capabilities enabled until billing gates are configured. */
export function hasAppointmentCapability(
  _workspaceId: string,
  _capability: AppointmentCapabilityKey,
): boolean {
  return true;
}
