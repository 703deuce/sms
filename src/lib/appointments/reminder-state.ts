import type { AppointmentMetadata } from "@/lib/appointments/types";

export function reminderKey(timelineType: string, generation: number): string {
  return `${generation}:${timelineType}`;
}

export function currentReminderGeneration(meta: AppointmentMetadata): number {
  return Number(meta.reminderGeneration) || 1;
}

export function reminderTimelineType(stepKey: string, minutesBefore?: number): string {
  if (stepKey === "confirmation") return "confirmation_sent";
  const minutes = minutesBefore ?? 0;
  return `reminder_${minutes}m_sent`;
}

function reminderKeyForRecipient(timelineType: string, generation: number, phoneE164?: string): string {
  const base = reminderKey(timelineType, generation);
  if (!phoneE164?.trim()) return base;
  return `${base}:${phoneE164.trim()}`;
}

export function wasReminderSent(
  meta: AppointmentMetadata,
  timelineType: string,
  phoneE164?: string,
): boolean {
  const gen = currentReminderGeneration(meta);
  const keys = meta.reminderSentKeys || [];
  if (phoneE164) {
    if (keys.includes(reminderKeyForRecipient(timelineType, gen, phoneE164))) return true;
    if (keys.includes(reminderKey(timelineType, gen)) && !keys.some((k) => k.startsWith(`${reminderKey(timelineType, gen)}:+`))) {
      return true;
    }
    return false;
  }
  if (keys.includes(reminderKey(timelineType, gen))) return true;
  if (keys.some((k) => k.startsWith(`${reminderKey(timelineType, gen)}:+`))) return true;
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
  phoneE164?: string,
): AppointmentMetadata {
  const gen = currentReminderGeneration(meta);
  const keys = new Set(meta.reminderSentKeys || []);
  keys.add(reminderKeyForRecipient(timelineType, gen, phoneE164));
  return {
    ...meta,
    reminderSentKeys: [...keys],
    reminderStatus: "sent",
  };
}
