import {
  appointmentWithinMinimumLeadTime,
  isReminderStepDisabledForService,
  resolveRecipientNotificationPreference,
  shouldRunReminderStepForRecipient,
} from "./reminder-scheduling-policy";
import { DEFAULT_PLATFORM_CONFIG } from "@/lib/appointments/types";

const config = {
  ...DEFAULT_PLATFORM_CONFIG,
  reminderPreferences: {
    minimumLeadTimeMinutes: 30,
    defaultNotificationChannel: "email" as const,
    serviceReminderRules: [
      { id: "1", serviceNameContains: "consult", disabledStepKeys: ["reminder2h"] },
    ],
  },
};

if (!isReminderStepDisabledForService(config, "reminder2h", "Initial consult")) {
  throw new Error("expected service rule to disable reminder2h");
}

if (resolveRecipientNotificationPreference({}, config) !== "email") {
  throw new Error("expected default email preference");
}

if (!shouldRunReminderStepForRecipient("email", "email")) {
  throw new Error("email pref should allow email step");
}

if (shouldRunReminderStepForRecipient("sms", "email")) {
  throw new Error("email pref should block sms step");
}

const startsSoon = new Date(Date.now() + 10 * 60_000);
if (!appointmentWithinMinimumLeadTime(startsSoon, config)) {
  throw new Error("expected within minimum lead time");
}

console.log("PASS reminder-scheduling-policy");
