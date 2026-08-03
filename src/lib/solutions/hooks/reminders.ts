import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";

/**
 * Windows (minutes before start) match
 * `src/lib/integrations/framework/appointment-reminders.ts` WINDOWS_MINUTES.
 */
const REMINDER_WINDOWS_MINUTES = [15, 30, 60, 120, 1440] as const;

const REMINDER_INSTRUCTIONS = `## Appointment reminders
- When booking, mention that automated reminders may be sent before the appointment (SMS/automation).
- Do not promise exact reminder times unless configured; the platform scans upcoming appointments on the reminder windows.
- Offer reschedule/cancel via calendar tools when the caller asks about changing a booked time.`;

const hook = defineCapabilityHook({
  id: "reminders",
  status: "live",
  notes:
    "Wires advanced.appointmentReminders to live appointment-reminders scan jobs (starting_soon windows)",
  onActivate: async (ctx) => {
    await applyCapabilityDraftPatch(ctx, "reminders", {
      instructionMarker: "## Appointment reminders",
      appendInstructions: REMINDER_INSTRUCTIONS,
      enableTools: ["send_sms", "reschedule_appointment", "cancel_appointment", "book_appointment"],
      advanced: {
        appointmentReminders: {
          enabled: true,
          framework: "appointment-reminders",
          /** Minutes-before windows handled by scanAppointmentsStartingSoon. */
          windowsMinutes: [...REMINDER_WINDOWS_MINUTES],
          channels: ["sms", "automation"],
          eventTypes: ["appointment.starting_soon", "appointment.completed"],
        },
        remindersEnabled: true,
      },
      messaging: {
        appointmentReminders: true,
        smsConfirmations: true,
      },
      postCall: {
        reminderOptInCapture: true,
        extractionFieldsExtra: ["appointment_booked", "appointment_time", "reminder_preferred"],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
