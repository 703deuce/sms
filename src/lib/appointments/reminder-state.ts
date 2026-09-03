import type { AppointmentMetadata } from "@/lib/appointments/types";

export function reminderKey(timelineType: string, generation: number): string {
  return `${generation}:${timelineType}`;
}

export function currentReminderGeneration(meta: AppointmentMetadata): number {
  return Number(meta.reminderGeneration) || 1;
}

export function wasReminderSent(meta: AppointmentMetadata, timelineType: string): boolean {
  const gen = currentReminderGeneration(meta);
  const keys = meta.reminderSentKeys || [];
  if (keys.includes(reminderKey(timelineType, gen))) return true;
  return (meta.timeline || []).some((e) => e.type === timelineType);
}

export function suppressAppointmentReminders(meta: AppointmentMetadata): AppointmentMetadata {
  return {
    ...meta,
    remindersSuppressed: true,
    reminderStatus: "canceled",
  };
}

/** Reschedule or rebuild — bump generation so stale scanner windows cannot fire. */
export function resetAppointmentReminders(meta: AppointmentMetadata): AppointmentMetadata {
  const nextGen = currentReminderGeneration(meta) + 1;
  return {
    ...meta,
    reminderGeneration: nextGen,
    remindersSuppressed: false,
    reminderStatus: "scheduled",
  };
}

export function markReminderSentInMeta(
  meta: AppointmentMetadata,
  timelineType: string,
): AppointmentMetadata {
  const gen = currentReminderGeneration(meta);
  const keys = new Set(meta.reminderSentKeys || []);
  keys.add(reminderKey(timelineType, gen));
  return {
    ...meta,
    reminderSentKeys: [...keys],
    reminderStatus: "sent",
  };
}
