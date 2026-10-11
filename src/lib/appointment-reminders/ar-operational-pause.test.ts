import assert from "node:assert/strict";
import { isArRemindersPaused } from "./ar-operational-pause";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

const base = { bookingEnabled: false, timezone: "UTC", reminders: {} } as AppointmentPlatformConfig;

assert.equal(isArRemindersPaused(base), false);

const indefinite = {
  ...base,
  appointmentReminders: {
    operationalPause: {
      pausedAt: new Date().toISOString(),
      indefinite: true,
    },
  },
} as AppointmentPlatformConfig;
assert.equal(isArRemindersPaused(indefinite), true);

const expired = {
  ...base,
  appointmentReminders: {
    operationalPause: {
      pausedAt: new Date(Date.now() - 3600_000).toISOString(),
      pausedUntil: new Date(Date.now() - 60_000).toISOString(),
    },
  },
} as AppointmentPlatformConfig;
assert.equal(isArRemindersPaused(expired), false);

console.log("ar-operational-pause.test.ts: ok");
