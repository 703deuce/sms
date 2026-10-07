import { createId } from "@/lib/supabase/id";
import { defaultAppointmentRemindersTemplateForStep } from "@/lib/appointment-reminders/default-reminder-templates";
import { DEFAULT_REMINDER_TEMPLATES } from "@/lib/appointments/types";
import type { ReminderChannel, ReminderStepConfig } from "@/lib/appointments/types";
import { estimateSmsSegments } from "@/lib/utils";
import {
  formatMinutesBeforeLabel,
  type CoreReminderStepKey,
  type ReminderStepId,
} from "@/lib/appointments/reminders/reminders-config";
import type { ReminderItem, RemindersPageModel } from "./types";

export const REMINDER_MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{business_name}}",
  "{{manage_link}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
  "{{confirm_link}}",
  "{{meeting_link}}",
  "{{join_meeting_line}}",
];

export type RemindersApiConfig = {
  timezone: string;
  reminders: {
    confirmation: ReminderStepConfig;
    reminder24h: ReminderStepConfig;
    reminder2h: ReminderStepConfig;
    additionalSteps?: Array<ReminderStepConfig & { id: string }>;
  };
};

export type ReminderPreviewMap = Partial<Record<string, string>>;

const CORE_ORDER: CoreReminderStepKey[] = ["confirmation", "reminder24h", "reminder2h"];

function defaultMinutesForKey(key: CoreReminderStepKey): number {
  if (key === "confirmation") return 0;
  if (key === "reminder24h") return 1440;
  return 120;
}

function mapReminderItem(
  stepKey: ReminderStepId,
  index: number,
  step: ReminderStepConfig,
  preview: string,
  minutesBefore: number,
): ReminderItem {
  const { characters, segments } = estimateSmsSegments(step.template || "");
  const timingLabel =
    stepKey === "confirmation"
      ? "Immediately after booking"
      : formatMinutesBeforeLabel(minutesBefore);
  return {
    id: stepKey === "confirmation" ? "booking-confirmation" : String(stepKey),
    stepKey,
    index,
    icon: stepKey === "confirmation" ? "calendar" : stepKey === "reminder24h" ? "clock" : "message",
    title: step.label,
    badge: timingLabel,
    description:
      stepKey === "confirmation"
        ? "Sent when a customer books online."
        : `Scheduled ${timingLabel.toLowerCase()}.`,
    channel: step.channel || "sms",
    template: step.template,
    preview,
    characters,
    segments: segments || 1,
    enabled: step.enabled,
    minutesBefore,
    timeOfDayAt: step.timeOfDay?.at,
    timeOfDayDaysBefore: step.timeOfDay?.daysBefore,
    skipWeekends: step.skipWeekends,
    skipOffHours: step.skipOffHours,
    skipClosedDays: step.skipClosedDays,
    stopOnReply: step.stopOnReply,
    attachIcs: step.channel === "email",
    isCustom: !CORE_ORDER.includes(stepKey as CoreReminderStepKey),
  };
}

export function buildRemindersPageModel(
  config: RemindersApiConfig,
  previews: ReminderPreviewMap,
): RemindersPageModel {
  const reminders: ReminderItem[] = [];
  let idx = 0;
  for (const key of CORE_ORDER) {
    const step = config.reminders[key];
    const minutes = step.minutesBefore ?? defaultMinutesForKey(key);
    reminders.push(mapReminderItem(key, ++idx, step, previews[key] || "", minutes));
  }
  for (const extra of config.reminders.additionalSteps || []) {
    reminders.push(
      mapReminderItem(
        extra.id,
        ++idx,
        extra,
        previews[extra.id] || "",
        extra.minutesBefore ?? 60,
      ),
    );
  }

  return {
    reminders,
    mergeTags: REMINDER_MERGE_TAGS,
    testStepOptions: reminders.map((r) => ({ key: r.stepKey, label: r.title })),
    smsSenderLabel: "Messages use your workspace SMS configuration. Reply STOP to opt out.",
  };
}

export function defaultTemplateForStep(stepKey: ReminderStepId): string {
  if (stepKey === "confirmation") return DEFAULT_REMINDER_TEMPLATES.confirmation;
  if (stepKey === "reminder24h") return DEFAULT_REMINDER_TEMPLATES.reminder24h;
  if (stepKey === "reminder2h") return DEFAULT_REMINDER_TEMPLATES.reminder2h;
  return DEFAULT_REMINDER_TEMPLATES.reminder2h;
}

function isCoreKey(stepKey: ReminderStepId): stepKey is CoreReminderStepKey {
  return CORE_ORDER.includes(stepKey as CoreReminderStepKey);
}

function updateStep(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  updater: (step: ReminderStepConfig) => ReminderStepConfig,
): RemindersApiConfig {
  if (isCoreKey(stepKey)) {
    return {
      ...config,
      reminders: {
        ...config.reminders,
        [stepKey]: updater(config.reminders[stepKey]),
      },
    };
  }
  const additional = (config.reminders.additionalSteps || []).map((s) =>
    s.id === stepKey ? { ...s, ...updater(s) } : s,
  );
  return { ...config, reminders: { ...config.reminders, additionalSteps: additional } };
}

export function patchReminderTemplate(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  template: string,
): RemindersApiConfig {
  return updateStep(config, stepKey, (step) => ({ ...step, template }));
}

export function patchReminderEnabled(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  enabled: boolean,
): RemindersApiConfig {
  return updateStep(config, stepKey, (step) => ({ ...step, enabled }));
}

export function patchReminderChannel(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  channel: ReminderChannel,
): RemindersApiConfig {
  return updateStep(config, stepKey, (step) => ({ ...step, channel }));
}

export function patchReminderMinutesBefore(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  minutesBefore: number,
): RemindersApiConfig {
  if (stepKey === "confirmation") return config;
  const safe = Math.max(1, Math.min(60 * 24 * 14, Math.round(minutesBefore)));
  return updateStep(config, stepKey, (step) => ({ ...step, minutesBefore: safe }));
}

export function patchReminderAdvanced(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
  patch: Partial<{
    timeOfDayAt: string;
    timeOfDayDaysBefore: number;
    skipWeekends: boolean;
    skipOffHours: boolean;
    stopOnReply: boolean;
    label: string;
  }>,
): RemindersApiConfig {
  return updateStep(config, stepKey, (step) => {
    const next = { ...step };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.timeOfDayAt !== undefined) {
      next.timeOfDay = {
        at: patch.timeOfDayAt,
        daysBefore: patch.timeOfDayDaysBefore ?? step.timeOfDay?.daysBefore ?? 0,
      };
    }
    if (patch.timeOfDayDaysBefore !== undefined && next.timeOfDay) {
      next.timeOfDay = { ...next.timeOfDay, daysBefore: patch.timeOfDayDaysBefore };
    }
    if (patch.skipWeekends !== undefined) next.skipWeekends = patch.skipWeekends;
    if (patch.skipOffHours !== undefined) next.skipOffHours = patch.skipOffHours;
    if (patch.stopOnReply !== undefined) next.stopOnReply = patch.stopOnReply;
    return next;
  });
}

export function resetReminderTemplate(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
): RemindersApiConfig {
  return patchReminderTemplate(config, stepKey, defaultTemplateForStep(stepKey));
}

/** Reset to Appointment Reminders (calendar-import) defaults — no booking self-service links. */
export function resetAppointmentRemindersTemplate(
  config: RemindersApiConfig,
  stepKey: ReminderStepId,
): RemindersApiConfig {
  return patchReminderTemplate(config, stepKey, defaultAppointmentRemindersTemplateForStep(stepKey));
}

export function addAdditionalReminderStep(config: RemindersApiConfig): RemindersApiConfig {
  const steps = [...(config.reminders.additionalSteps || [])];
  if (steps.length >= 8) return config;
  const id = createId();
  steps.push({
    id,
    enabled: true,
    channel: "sms",
    label: "Custom reminder",
    minutesBefore: 30,
    template: DEFAULT_REMINDER_TEMPLATES.reminder2h,
  });
  return { ...config, reminders: { ...config.reminders, additionalSteps: steps } };
}

export function removeReminderStep(config: RemindersApiConfig, stepKey: ReminderStepId): RemindersApiConfig {
  if (isCoreKey(stepKey)) return config;
  return {
    ...config,
    reminders: {
      ...config.reminders,
      additionalSteps: (config.reminders.additionalSteps || []).filter((s) => s.id !== stepKey),
    },
  };
}
