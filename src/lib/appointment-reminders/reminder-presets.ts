import type { AppointmentPlatformConfig, ReminderStepConfig } from "@/lib/appointments/types";
import { DEFAULT_REMINDER_TEMPLATES } from "@/lib/appointments/types";
import { createId } from "@/lib/supabase/id";

export type ReminderIndustryId =
  | "general"
  | "healthcare_dental"
  | "salon_spa"
  | "legal"
  | "financial"
  | "real_estate"
  | "counseling_wellness"
  | "massage"
  | "fitness"
  | "education"
  | "photography"
  | "automotive"
  | "home_services"
  | "veterinary";

export type ReminderToneId = "formal" | "casual" | "warm" | "friendly";

export type ReminderTimingPresetId =
  | "simple_24h"
  | "standard_48h_3h"
  | "confirmation_focused"
  | "long_lead"
  | "custom";

export type ReminderLocaleCode = "en" | "es" | "fr";

type StepTemplates = {
  confirmation: string;
  reminder24h: string;
  reminder2h: string;
};

function tonePrefix(tone: ReminderToneId): { sms: string; email: string } {
  switch (tone) {
    case "formal":
      return { sms: "", email: "Dear {{first_name}},\n\n" };
    case "casual":
      return { sms: "Hey ", email: "Hi {{first_name}},\n\n" };
    case "warm":
      return { sms: "Hi ", email: "Hello {{first_name}},\n\n" };
    case "friendly":
      return { sms: "Hi there! ", email: "Hi {{first_name}},\n\n" };
    default:
      return { sms: "Hi ", email: "Hi {{first_name}},\n\n" };
  }
}

const INDUSTRY_SERVICE_LABEL: Record<ReminderIndustryId, string> = {
  general: "appointment",
  healthcare_dental: "visit",
  salon_spa: "appointment",
  legal: "consultation",
  financial: "meeting",
  real_estate: "showing",
  counseling_wellness: "session",
  massage: "massage",
  fitness: "training session",
  education: "lesson",
  photography: "session",
  automotive: "service appointment",
  home_services: "service visit",
  veterinary: "pet visit",
};

export function buildIndustryReminderTemplates(
  industry: ReminderIndustryId,
  tone: ReminderToneId,
): StepTemplates {
  const svc = INDUSTRY_SERVICE_LABEL[industry] || "appointment";
  const p = tonePrefix(tone);
  const baseConfirm = DEFAULT_REMINDER_TEMPLATES.confirmation.replace(/\{\{service\}\}/g, svc);
  const base24 = DEFAULT_REMINDER_TEMPLATES.reminder24h.replace(/\{\{service\}\}/g, svc);
  const base2 = DEFAULT_REMINDER_TEMPLATES.reminder2h.replace(/\{\{service\}\}/g, svc);
  return {
    confirmation: `${p.sms}${baseConfirm}`,
    reminder24h: `${p.sms}${base24}`,
    reminder2h: `${p.sms}${base2}`,
  };
}

export const CANCELLATION_POLICY_PRESETS: Array<{ id: string; label: string; text: string }> = [
  {
    id: "flexible_24h",
    label: "24-hour notice",
    text: "Please let us know at least 24 hours before your appointment if you need to cancel or reschedule.",
  },
  {
    id: "same_day",
    label: "Same-day courtesy",
    text: "If your plans change, contact us as soon as possible so we can offer your time to another client.",
  },
  {
    id: "healthcare",
    label: "Healthcare courtesy",
    text: "Missed appointments may delay care for other patients. Call us if you cannot attend.",
  },
  {
    id: "no_fee",
    label: "No fee stated",
    text: "Contact us to cancel or reschedule. We do not charge a cancellation fee through this message.",
  },
];

export const REMINDER_TIMING_PRESETS: Record<
  ReminderTimingPresetId,
  { label: string; description: string; apply: (steps: AppointmentPlatformConfig["reminders"]) => AppointmentPlatformConfig["reminders"] }
> = {
  simple_24h: {
    label: "Simple — 24 hours before",
    description: "Confirmation plus one reminder one day ahead.",
    apply: (r) => ({
      ...r,
      reminder24h: { ...r.reminder24h, enabled: true, minutesBefore: 1440 },
      reminder2h: { ...r.reminder2h, enabled: false },
      additionalSteps: [],
    }),
  },
  standard_48h_3h: {
    label: "Standard — 48 hours and 3 hours before",
    description: "Confirmation, 2-day reminder, and a 3-hour heads-up.",
    apply: (r) => ({
      ...r,
      reminder24h: { ...r.reminder24h, enabled: true, minutesBefore: 2880, label: "2-day reminder" },
      reminder2h: { ...r.reminder2h, enabled: true, minutesBefore: 180, label: "3-hour reminder" },
      additionalSteps: [],
    }),
  },
  confirmation_focused: {
    label: "Confirmation-focused",
    description: "72h, 24h, and 3h touchpoints.",
    apply: (r) => ({
      ...r,
      reminder24h: { ...r.reminder24h, enabled: true, minutesBefore: 4320, label: "3-day reminder" },
      reminder2h: { ...r.reminder2h, enabled: true, minutesBefore: 180, label: "3-hour reminder" },
      additionalSteps: (r.additionalSteps || []).filter((s) => s.minutesBefore !== 1440).concat(
        !(r.additionalSteps || []).some((s) => s.minutesBefore === 1440)
          ? [
              {
                id: createId(),
                enabled: true,
                channel: r.reminder24h.channel,
                label: "24-hour reminder",
                minutesBefore: 1440,
                template: r.reminder24h.template,
              },
            ]
          : [],
      ),
    }),
  },
  long_lead: {
    label: "Long lead",
    description: "7 days, 24 hours, and 3 hours before.",
    apply: (r) => ({
      ...r,
      reminder24h: { ...r.reminder24h, enabled: true, minutesBefore: 10080, label: "7-day reminder" },
      reminder2h: { ...r.reminder2h, enabled: true, minutesBefore: 180 },
      additionalSteps: (r.additionalSteps || [])
        .filter((s) => s.minutesBefore !== 1440)
        .concat(
          !(r.additionalSteps || []).some((s) => s.minutesBefore === 1440)
            ? [
                {
                  id: createId(),
                  enabled: true,
                  channel: r.reminder24h.channel,
                  label: "24-hour reminder",
                  minutesBefore: 1440,
                  template: DEFAULT_REMINDER_TEMPLATES.reminder24h,
                },
              ]
            : [],
        ),
    }),
  },
  custom: {
    label: "Custom",
    description: "Keep your current timing; edit steps individually.",
    apply: (r) => r,
  },
};

export function applyReminderPresetBundle(input: {
  config: AppointmentPlatformConfig;
  industry?: ReminderIndustryId;
  tone?: ReminderToneId;
  timing?: ReminderTimingPresetId;
  cancellationPolicyId?: string;
  locale?: ReminderLocaleCode;
}): AppointmentPlatformConfig {
  const industry = input.industry || "general";
  const tone = input.tone || "friendly";
  const timing = input.timing || "custom";
  const templates = buildIndustryReminderTemplates(industry, tone);

  let reminders = {
    ...input.config.reminders,
    confirmation: { ...input.config.reminders.confirmation, template: templates.confirmation },
    reminder24h: { ...input.config.reminders.reminder24h, template: templates.reminder24h },
    reminder2h: { ...input.config.reminders.reminder2h, template: templates.reminder2h },
  };
  reminders = REMINDER_TIMING_PRESETS[timing].apply(reminders);

  const policy = CANCELLATION_POLICY_PRESETS.find((p) => p.id === input.cancellationPolicyId);

  return {
    ...input.config,
    reminders,
    reminderPreferences: {
      ...input.config.reminderPreferences,
      templateLocale: input.locale || input.config.reminderPreferences?.templateLocale || "en",
      cancellationPolicyText:
        policy?.text || input.config.reminderPreferences?.cancellationPolicyText,
    },
  };
}

export function listReminderPresetCatalog() {
  return {
    industries: Object.keys(INDUSTRY_SERVICE_LABEL) as ReminderIndustryId[],
    tones: ["formal", "casual", "warm", "friendly"] as ReminderToneId[],
    timing: Object.entries(REMINDER_TIMING_PRESETS).map(([id, v]) => ({
      id,
      label: v.label,
      description: v.description,
    })),
    cancellationPolicies: CANCELLATION_POLICY_PRESETS,
    locales: ["en", "es", "fr"] as ReminderLocaleCode[],
  };
}

export function stepEmailSubjectDefault(step: ReminderStepConfig, businessName: string): string {
  if (step.emailSubject?.trim()) return step.emailSubject.trim();
  return `${step.label} — ${businessName}`;
}
