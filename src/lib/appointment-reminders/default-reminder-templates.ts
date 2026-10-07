/**
 * Default SMS templates for the Appointment Reminders product (calendar import only).
 * No manage / reschedule / cancel links — this product does not host booking self-service.
 */
export const APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES = {
  confirmation:
    "Hi {{first_name}}, your {{service}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.{{join_meeting_line}}",
  reminder24h:
    "Reminder: {{service}} with {{business_name}} tomorrow at {{appointment_time}}.{{join_meeting_line}}",
  reminder2h:
    "Reminder: {{service}} with {{business_name}} today at {{appointment_time}}.{{join_meeting_line}}",
} as const

export type AppointmentRemindersTemplateKey = keyof typeof APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES

export function defaultAppointmentRemindersTemplateForStep(
  stepKey: string,
): string {
  if (stepKey === "confirmation") return APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES.confirmation
  if (stepKey === "reminder24h") return APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES.reminder24h
  if (stepKey === "reminder2h") return APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES.reminder2h
  return APPOINTMENT_REMINDERS_DEFAULT_TEMPLATES.reminder2h
}
