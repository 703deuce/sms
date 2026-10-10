import { shouldSkipReminderSendNow } from "./reminder-send-time-policy";
import type { ReminderStepConfig } from "@/lib/appointments/types";
import { defaultWeeklyHours } from "@/lib/appointments/availability-engine-policy";

const weekly = defaultWeeklyHours();

function step(partial: Partial<ReminderStepConfig>): ReminderStepConfig {
  return {
    enabled: true,
    channel: "sms",
    template: "hi",
    label: "test",
    ...partial,
  };
}

// Monday 2026-10-12 14:00 UTC = 10:00 Eastern (within 9-17)
const mondayMorningEt = new Date("2026-10-12T14:00:00.000Z");

if (
  shouldSkipReminderSendNow({
    step: step({ skipOffHours: true }),
    fireAt: mondayMorningEt,
    weeklyHours: weekly,
    timezone: "America/New_York",
  })
) {
  throw new Error("expected within business hours on Monday morning ET");
}

// Saturday
const saturday = new Date("2026-10-10T14:00:00.000Z");
if (
  !shouldSkipReminderSendNow({
    step: step({ skipWeekends: true }),
    fireAt: saturday,
    weeklyHours: weekly,
    timezone: "America/New_York",
  })
) {
  throw new Error("expected skip weekends on Saturday");
}

// Quiet hours 09:00-17:00 — 20:00 ET should skip
const evening = new Date("2026-10-12T00:00:00.000Z"); // 20:00 ET Oct 11
if (
  !shouldSkipReminderSendNow({
    step: step({ skipOffHours: true }),
    fireAt: evening,
    weeklyHours: weekly,
    timezone: "America/New_York",
    reminderQuietHours: { enabled: true, start: "09:00", end: "17:00" },
  })
) {
  throw new Error("expected skip outside quiet hours window");
}

console.log("PASS reminder-send-time-policy");
