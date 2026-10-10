import type {
  AppointmentPlatformConfig,
  AppointmentMetadata,
  ReminderChannel,
  ReminderStepConfig,
} from "@/lib/appointments/types";

export function resolveMinimumLeadTimeMinutes(config: AppointmentPlatformConfig): number {
  const raw = config.reminderPreferences?.minimumLeadTimeMinutes;
  if (typeof raw === "number" && raw >= 0) return Math.min(raw, 7 * 24 * 60);
  return 15;
}

export function appointmentWithinMinimumLeadTime(
  startsAt: Date,
  config: AppointmentPlatformConfig,
  nowMs = Date.now(),
): boolean {
  const leadMs = resolveMinimumLeadTimeMinutes(config) * 60_000;
  return startsAt.getTime() - nowMs < leadMs;
}

function matchingServiceRule(config: AppointmentPlatformConfig, serviceName: string | null) {
  const rules = config.reminderPreferences?.serviceReminderRules || [];
  const name = (serviceName || "").toLowerCase();
  if (!name) return null;
  return rules.find((r) => name.includes(r.serviceNameContains.toLowerCase().trim())) || null;
}

export function isReminderStepDisabledForService(
  config: AppointmentPlatformConfig,
  stepKey: string,
  serviceName: string | null,
): boolean {
  const rule = matchingServiceRule(config, serviceName);
  if (!rule?.disabledStepKeys?.length) return false;
  return rule.disabledStepKeys.includes(stepKey);
}

export function resolveStepChannelForAppointment(
  step: ReminderStepConfig,
  config: AppointmentPlatformConfig,
  serviceName: string | null,
): ReminderChannel {
  const rule = matchingServiceRule(config, serviceName);
  if (rule?.channelOverride) return rule.channelOverride;
  return step.channel || "sms";
}

export type RecipientNotificationPreference = "sms" | "email" | "both";

export function resolveRecipientNotificationPreference(
  meta: AppointmentMetadata,
  config: AppointmentPlatformConfig,
): RecipientNotificationPreference {
  const raw = meta.recipientNotificationChannel as RecipientNotificationPreference | undefined;
  if (raw === "sms" || raw === "email" || raw === "both") return raw;
  const def = config.reminderPreferences?.defaultNotificationChannel;
  if (def === "sms" || def === "email" || def === "both") return def;
  return "both";
}

/** Recipient preference never overrides consent — only channel selection when eligible. */
export function shouldRunReminderStepForRecipient(
  stepChannel: ReminderChannel,
  pref: RecipientNotificationPreference,
): boolean {
  if (pref === "both") return true;
  if (pref === "sms") return stepChannel === "sms" || stepChannel === "voice";
  if (pref === "email") return stepChannel === "email";
  return true;
}
