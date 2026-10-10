/**
 * Authoritative Appointment Reminders commercial plan catalog.
 * All allowances and feature flags — do not duplicate limits in UI or route handlers.
 */

export type ArPlanKey = "free" | "starter" | "growth" | "business";

export type ArAiReschedulerModeAllowed = "reminders_only" | "notify" | "ai";

export type ArPlanDefinition = {
  key: ArPlanKey;
  displayName: string;
  monthlyPriceCents: number;
  /** Outbound SMS segments per billing period */
  smsSegmentsPerMonth: number;
  emailsPerMonth: number;
  importedCalendarsMax: number;
  reminderStepsMax: number;
  customReminderTiming: "basic" | "full";
  editableEmailTemplates: boolean;
  smsConfirmationsAndResponses: boolean;
  staffNotifiedRescheduleCancel: boolean;
  aiReschedulerModes: ArAiReschedulerModeAllowed[];
  aiConversationsPerMonth: number;
  aiInsights: boolean;
};

export const AR_PLAN_CATALOG: Record<ArPlanKey, ArPlanDefinition> = {
  free: {
    key: "free",
    displayName: "Free",
    monthlyPriceCents: 0,
    smsSegmentsPerMonth: 25,
    emailsPerMonth: 100,
    importedCalendarsMax: 1,
    reminderStepsMax: 1,
    customReminderTiming: "basic",
    editableEmailTemplates: false,
    smsConfirmationsAndResponses: false,
    staffNotifiedRescheduleCancel: false,
    aiReschedulerModes: ["reminders_only"],
    aiConversationsPerMonth: 0,
    aiInsights: false,
  },
  starter: {
    key: "starter",
    displayName: "Starter",
    monthlyPriceCents: 900,
    smsSegmentsPerMonth: 200,
    emailsPerMonth: 500,
    importedCalendarsMax: 1,
    reminderStepsMax: 3,
    customReminderTiming: "full",
    editableEmailTemplates: true,
    smsConfirmationsAndResponses: true,
    staffNotifiedRescheduleCancel: true,
    aiReschedulerModes: ["reminders_only", "notify"],
    aiConversationsPerMonth: 0,
    aiInsights: false,
  },
  growth: {
    key: "growth",
    displayName: "Growth",
    monthlyPriceCents: 1900,
    smsSegmentsPerMonth: 500,
    emailsPerMonth: 1500,
    importedCalendarsMax: 3,
    reminderStepsMax: 3,
    customReminderTiming: "full",
    editableEmailTemplates: true,
    smsConfirmationsAndResponses: true,
    staffNotifiedRescheduleCancel: true,
    aiReschedulerModes: ["reminders_only", "notify", "ai"],
    aiConversationsPerMonth: 25,
    aiInsights: true,
  },
  business: {
    key: "business",
    displayName: "Business",
    monthlyPriceCents: 3900,
    smsSegmentsPerMonth: 1200,
    emailsPerMonth: 3000,
    importedCalendarsMax: 10,
    reminderStepsMax: 3,
    customReminderTiming: "full",
    editableEmailTemplates: true,
    smsConfirmationsAndResponses: true,
    staffNotifiedRescheduleCancel: true,
    aiReschedulerModes: ["reminders_only", "notify", "ai"],
    aiConversationsPerMonth: 100,
    aiInsights: true,
  },
};

export const AR_PAID_PLAN_KEYS: ArPlanKey[] = ["starter", "growth", "business"];

export function arPlanDefinition(plan: ArPlanKey): ArPlanDefinition {
  return AR_PLAN_CATALOG[plan];
}

export function isArPlanKey(value: string): value is ArPlanKey {
  return value === "free" || value === "starter" || value === "growth" || value === "business";
}
