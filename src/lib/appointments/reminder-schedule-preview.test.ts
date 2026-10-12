import { buildFutureReminderSchedule } from "./reminder-engine";
import type { AppointmentMetadata, ReminderStepConfig } from "./types";
import { defaultWeeklyHours } from "@/lib/appointments/availability-engine-policy";

const weekly = defaultWeeklyHours();

const confirmation: ReminderStepConfig = {
  enabled: true,
  channel: "sms",
  template: "confirmation",
  label: "Booking confirmation",
  minutesBefore: 0,
};

const reminder24h: ReminderStepConfig = {
  enabled: true,
  channel: "sms",
  template: "reminder",
  label: "24-hour reminder",
  minutesBefore: 1440,
};

const reminder2h: ReminderStepConfig = {
  enabled: true,
  channel: "sms",
  template: "reminder",
  label: "2-hour reminder",
  minutesBefore: 120,
};

const meta = {} as AppointmentMetadata;

// Booked now; appointment in 44 hours — confirmation should be immediate, 24h in ~20h
const createdAt = new Date("2026-10-12T12:00:00.000Z");
const startsAt = new Date(createdAt.getTime() + 44 * 60 * 60_000);

const preview = buildFutureReminderSchedule({
  startsAt: startsAt.toISOString(),
  createdAt: createdAt.toISOString(),
  timezone: "America/New_York",
  steps: [
    { key: "confirmation", step: confirmation },
    { key: "reminder24h", step: reminder24h },
    { key: "reminder2h", step: reminder2h },
  ],
  metadata: meta,
  weeklyHours: weekly,
});

const conf = preview.find((p) => p.stepKey === "confirmation");
const h24 = preview.find((p) => p.stepKey === "reminder24h");

if (!conf || conf.scheduledFor !== createdAt.toISOString()) {
  throw new Error(
    `confirmation should fire at booking time, got ${conf?.scheduledFor} (status ${conf?.status})`,
  );
}

if (!h24 || h24.status !== "scheduled") {
  throw new Error(`24h step should be scheduled, got ${h24?.status}`);
}

const h24Ms = new Date(h24.scheduledFor).getTime();
const expected24 = startsAt.getTime() - 1440 * 60_000;
if (Math.abs(h24Ms - expected24) > 60_000) {
  throw new Error(`24h fire time off by more than 1 min: ${h24.scheduledFor}`);
}

// Booked 20h before appointment (<24h lead) — skip 24h, keep 2h
const lateBook = new Date(startsAt.getTime() - 20 * 60 * 60_000);
const previewLate = buildFutureReminderSchedule({
  startsAt: startsAt.toISOString(),
  createdAt: lateBook.toISOString(),
  timezone: "America/New_York",
  steps: [
    { key: "confirmation", step: confirmation },
    { key: "reminder24h", step: reminder24h },
    { key: "reminder2h", step: reminder2h },
  ],
  metadata: meta,
  weeklyHours: weekly,
});

const h24Late = previewLate.find((p) => p.stepKey === "reminder24h");
if (h24Late?.status !== "skipped") {
  throw new Error(`24h should skip when booked inside 24h window, got ${h24Late?.status}`);
}

console.log("PASS reminder-schedule-preview");
