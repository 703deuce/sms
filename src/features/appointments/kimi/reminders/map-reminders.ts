import { DEFAULT_REMINDER_TEMPLATES } from "@/lib/appointments/types";
import type { ReminderChannel, ReminderStepConfig } from "@/lib/appointments/types";
import { estimateSmsSegments } from "@/lib/utils";
import type {
  ReminderItem,
  ReminderStepKey,
  RemindersPageModel,
} from "./types";

export const REMINDER_MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{business_name}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
  "{{confirm_link}}",
  "{{meeting_link}}",
  "{{join_meeting_line}}",
];

const STEP_META: Record<
  ReminderStepKey,
  Pick<ReminderItem, "id" | "icon" | "badge" | "description">
> = {
  confirmation: {
    id: "booking-confirmation",
    icon: "calendar",
    badge: "At booking",
    description: "Sent immediately when a customer books online.",
  },
  reminder24h: {
    id: "24-hour",
    icon: "clock",
    badge: "24h before",
    description: "Sent the day before the appointment.",
  },
  reminder2h: {
    id: "2-hour",
    icon: "message",
    badge: "2h before",
    description: "Sent shortly before the appointment.",
  },
};

export type RemindersApiConfig = {
  timezone: string;
  reminders: Record<ReminderStepKey, ReminderStepConfig>;
};

export type ReminderPreviewMap = Partial<Record<ReminderStepKey, string>>;

function mapReminderItem(
  stepKey: ReminderStepKey,
  index: number,
  step: ReminderStepConfig,
  preview: string,
): ReminderItem {
  const meta = STEP_META[stepKey];
  const { characters, segments } = estimateSmsSegments(step.template || "");
  return {
    id: meta.id,
    stepKey,
    index,
    icon: meta.icon,
    title: step.label,
    badge: meta.badge,
    description: meta.description,
    channel: step.channel || "sms",
    template: step.template,
    preview,
    characters,
    segments: segments || 1,
    enabled: step.enabled,
    timeOfDayAt: step.timeOfDay?.at,
    timeOfDayDaysBefore: step.timeOfDay?.daysBefore,
    skipWeekends: step.skipWeekends,
    skipOffHours: step.skipOffHours,
    skipClosedDays: step.skipClosedDays,
    stopOnReply: step.stopOnReply,
    attachIcs: step.channel === "email",
  };
}

export function buildRemindersPageModel(
  config: RemindersApiConfig,
  previews: ReminderPreviewMap,
): RemindersPageModel {
  const keys: ReminderStepKey[] = ["confirmation", "reminder24h", "reminder2h"];
  const reminders = keys.map((key, index) =>
    mapReminderItem(key, index + 1, config.reminders[key], previews[key] || ""),
  );

  return {
    reminders,
    mergeTags: REMINDER_MERGE_TAGS,
    testStepOptions: reminders.map((r) => ({ key: r.stepKey, label: r.title })),
    smsSenderLabel: "Messages are sent via SMS from your business number. Standard message rates may apply.",
  };
}

export function defaultTemplateForStep(stepKey: ReminderStepKey): string {
  return DEFAULT_REMINDER_TEMPLATES[stepKey];
}

export function patchReminderTemplate(
  config: RemindersApiConfig,
  stepKey: ReminderStepKey,
  template: string,
): RemindersApiConfig {
  return {
    ...config,
    reminders: {
      ...config.reminders,
      [stepKey]: { ...config.reminders[stepKey], template },
    },
  };
}

export function patchReminderEnabled(
  config: RemindersApiConfig,
  stepKey: ReminderStepKey,
  enabled: boolean,
): RemindersApiConfig {
  return {
    ...config,
    reminders: {
      ...config.reminders,
      [stepKey]: { ...config.reminders[stepKey], enabled },
    },
  };
}

export function patchReminderChannel(
  config: RemindersApiConfig,
  stepKey: ReminderStepKey,
  channel: ReminderChannel,
): RemindersApiConfig {
  return {
    ...config,
    reminders: {
      ...config.reminders,
      [stepKey]: { ...config.reminders[stepKey], channel },
    },
  };
}

export function patchReminderAdvanced(
  config: RemindersApiConfig,
  stepKey: ReminderStepKey,
  patch: Partial<{
    timeOfDayAt: string;
    timeOfDayDaysBefore: number;
    skipWeekends: boolean;
    skipOffHours: boolean;
    stopOnReply: boolean;
    attachIcs: boolean;
  }>,
): RemindersApiConfig {
  const step = config.reminders[stepKey];
  const next = { ...step };
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
  return {
    ...config,
    reminders: { ...config.reminders, [stepKey]: next },
  };
}

export function resetReminderTemplate(
  config: RemindersApiConfig,
  stepKey: ReminderStepKey,
): RemindersApiConfig {
  return patchReminderTemplate(config, stepKey, defaultTemplateForStep(stepKey));
}
