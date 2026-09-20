import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { DEFAULT_VOICE_V3_AFTER_HOURS_NOTIFICATIONS } from "./defaults";
import type {
  VoiceV3AfterHoursNotificationsConfig,
  VoiceV3NotificationEventKey,
} from "./types";

function eventFlags(
  wizard: AppointmentReceptionistWizardState,
  key: VoiceV3NotificationEventKey,
): { sms: boolean; email: boolean } {
  const events = wizard.afterHoursNotificationEvents;
  const row = events?.[key];
  const defaults = DEFAULT_VOICE_V3_AFTER_HOURS_NOTIFICATIONS.events[key];
  return {
    sms: row?.sms ?? defaults.sms,
    email: row?.email ?? defaults.email,
  };
}

export function compileAfterHoursNotificationsFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AfterHoursNotificationsConfig {
  const base = DEFAULT_VOICE_V3_AFTER_HOURS_NOTIFICATIONS;
  const recipients = (wizard.afterHoursNotificationRecipients ?? [])
    .filter((r) => r && r.enabled !== false)
    .map((r) => ({
      id: r.id,
      label: r.label?.trim() || "Recipient",
      smsE164: r.smsE164?.trim() || null,
      email: r.email?.trim() || null,
      smsEnabled: r.smsEnabled !== false,
      emailEnabled: r.emailEnabled !== false,
      enabled: true,
    }));

  const primaryEmail = recipients.find((r) => r.emailEnabled && r.email)?.email ?? null;

  return {
    dailyDigest: {
      enabled: Boolean(wizard.afterHoursDailySummaryEnabled),
      recipientEmail: wizard.afterHoursDailySummaryEmail?.trim() || primaryEmail,
    },
    events: {
      "callback.requested": eventFlags(wizard, "callback.requested"),
      emergency: eventFlags(wizard, "emergency"),
      "transfer.failed": eventFlags(wizard, "transfer.failed"),
      "transfer.connected": eventFlags(wizard, "transfer.connected"),
      "appointment.booked": eventFlags(wizard, "appointment.booked"),
      "appointment.changed": eventFlags(wizard, "appointment.changed"),
      "call.completed": eventFlags(wizard, "call.completed"),
    },
    recipients: recipients.length ? recipients : base.recipients,
  };
}
