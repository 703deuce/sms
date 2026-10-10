import { resolveEffectiveReminderFireTime } from "./reminder-effective-fire-time";
import type { ReminderStepConfig } from "@/lib/appointments/types";
import { defaultWeeklyHours } from "@/lib/appointments/availability-engine-policy";

const weekly = {
  ...defaultWeeklyHours(),
  saturday: [],
  sunday: [],
};

const step24h: ReminderStepConfig = {
  enabled: true,
  channel: "sms",
  template: "reminder",
  label: "24h",
  minutesBefore: 1440,
  skipOffHours: true,
  skipClosedDays: true,
};

// Monday Oct 19 2026 8:00 AM America/New_York → 12:00 UTC
const mondayStart = new Date("2026-10-19T12:00:00.000Z");
const bookedFriday = new Date("2026-10-16T15:00:00.000Z");

const resolved = resolveEffectiveReminderFireTime({
  step: step24h,
  startsAt: mondayStart,
  createdAt: bookedFriday,
  weeklyHours: weekly,
  timezone: "America/New_York",
});

if ("reason" in resolved) {
  throw new Error(`expected deferred fire time, got ${resolved.reason}`);
}

// Nominal: Sunday Oct 12 8am ET (closed) → defer to Friday afternoon
const nominalMs = resolved.nominalFireAt.getTime();
const effectiveMs = resolved.effectiveFireAt.getTime();
if (effectiveMs >= nominalMs) {
  throw new Error("expected effective fire before nominal when Sunday is closed");
}
if (!resolved.deferred || resolved.strategy !== "latest_before_nominal") {
  throw new Error("expected latest_before_nominal defer strategy");
}

const fridayDay = resolved.effectiveFireAt.toLocaleString("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
});
if (fridayDay !== "Friday") {
  throw new Error(`expected Friday deferred send, got ${fridayDay}`);
}

console.log("PASS reminder-effective-fire-time");
