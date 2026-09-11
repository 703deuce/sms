import type { AppointmentPlatformConfig, ReminderStepConfig } from "@/lib/appointments/types";

export type CoreReminderStepKey = "confirmation" | "reminder24h" | "reminder2h";
export type ReminderStepId = CoreReminderStepKey | string;

export type AdditionalReminderStep = ReminderStepConfig & { id: string };

export function formatMinutesBeforeLabel(minutes: number): string {
  if (minutes <= 0) return "Immediately after booking";
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} day${d === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"} before`;
  }
  return `${minutes} min before`;
}

export function resolveReminderStep(
  config: AppointmentPlatformConfig,
  stepId: ReminderStepId,
): ReminderStepConfig | null {
  if (stepId === "confirmation" || stepId === "reminder24h" || stepId === "reminder2h") {
    return config.reminders[stepId] ?? null;
  }
  const extra = (config.reminders.additionalSteps || []).find((s) => s.id === stepId);
  return extra ?? null;
}

export function listReminderStepIds(config: AppointmentPlatformConfig): ReminderStepId[] {
  const ids: ReminderStepId[] = ["confirmation", "reminder24h", "reminder2h"];
  for (const s of config.reminders.additionalSteps || []) ids.push(s.id);
  return ids;
}

export function listEnabledReminderSteps(config: AppointmentPlatformConfig): Array<{
  id: ReminderStepId;
  step: ReminderStepConfig;
  minutesBefore: number;
  immediate?: boolean;
}> {
  const out: Array<{
    id: ReminderStepId;
    step: ReminderStepConfig;
    minutesBefore: number;
    immediate?: boolean;
  }> = [];

  if (config.reminders.confirmation.enabled) {
    out.push({
      id: "confirmation",
      step: config.reminders.confirmation,
      minutesBefore: 0,
      immediate: true,
    });
  }

  for (const key of ["reminder24h", "reminder2h"] as CoreReminderStepKey[]) {
    const step = config.reminders[key];
    if (!step.enabled) continue;
    const minutesBefore = step.minutesBefore || (key === "reminder24h" ? 1440 : 120);
    out.push({ id: key, step, minutesBefore });
  }

  for (const extra of config.reminders.additionalSteps || []) {
    if (!extra.enabled) continue;
    out.push({
      id: extra.id,
      step: extra,
      minutesBefore: extra.minutesBefore ?? 60,
    });
  }

  return out.sort((a, b) => {
    if (a.immediate) return -1;
    if (b.immediate) return 1;
    return b.minutesBefore - a.minutesBefore;
  });
}
