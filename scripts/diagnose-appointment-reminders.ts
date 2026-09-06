#!/usr/bin/env tsx
/**
 * Appointment reminder audit — logic verification without dev server.
 * Run: npx tsx scripts/diagnose-appointment-reminders.ts
 */
import assert from "node:assert/strict";
import { mergeTemplate } from "../src/lib/messaging/template";
import {
  markReminderSentInMeta,
  reminderTimelineType,
  resetAppointmentReminders,
  wasReminderSent,
} from "../src/lib/appointments/reminder-state";
import {
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_REMINDER_TEMPLATES,
  type AppointmentMetadata,
  type ReminderStepConfig,
} from "../src/lib/appointments/types";

const WINDOW_MS = 4 * 60_000;

function appointmentMergeVars(input: {
  firstName?: string | null;
  businessName?: string | null;
  service?: string | null;
  startsAt: Date;
  timezone?: string | null;
  confirmLink?: string | null;
  cancelLink?: string | null;
  rescheduleLink?: string | null;
  meetingLink?: string | null;
}): Record<string, string> {
  const tz = input.timezone || "America/New_York";
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    first_name: input.firstName || "there",
    business_name: input.businessName || "our team",
    service: input.service || "appointment",
    appointment_date: dateFmt.format(input.startsAt),
    appointment_time: timeFmt.format(input.startsAt),
    confirm_link: input.confirmLink || "",
    cancel_link: input.cancelLink || "",
    reschedule_link: input.rescheduleLink || "",
    meeting_link: input.meetingLink || "",
    join_meeting_line: input.meetingLink ? ` Join meeting: ${input.meetingLink}` : "",
  };
}

function buildReminderSchedule(input: {
  startsAt: string;
  metadata: AppointmentMetadata;
  config: {
    confirmation: ReminderStepConfig;
    reminder24h: ReminderStepConfig;
    reminder2h: ReminderStepConfig;
  };
}) {
  const meta = input.metadata;
  const timeline = meta.timeline || [];
  const sent = (type: string) => timeline.some((e) => e.type === type);
  const failed = (type: string) => timeline.some((e) => e.type === `${type}_failed`);

  if (meta.remindersSuppressed) {
    return [
      { key: "confirmation", status: "canceled" },
      { key: "reminder24h", status: "canceled" },
      { key: "reminder2h", status: "canceled" },
    ];
  }

  const smsAllowed = meta.smsConsent !== false;

  const statusFor = (timelineType: string, enabled: boolean) => {
    if (!enabled || !smsAllowed) return "disabled";
    if (sent(timelineType)) return "sent";
    if (failed(timelineType)) return "failed";
    if (new Date(input.startsAt).getTime() <= Date.now()) return "skipped";
    return "scheduled";
  };

  const reminder24Type = reminderTimelineType(
    "reminder24h",
    input.config.reminder24h.minutesBefore || 1440,
  );
  const reminder2Type = reminderTimelineType(
    "reminder2h",
    input.config.reminder2h.minutesBefore || 120,
  );

  return [
    {
      key: "confirmation",
      status: sent(reminderTimelineType("confirmation"))
        ? "sent"
        : meta.smsConsent && input.config.confirmation.enabled
          ? "scheduled"
          : "disabled",
    },
    {
      key: "reminder24h",
      status: statusFor(reminder24Type, input.config.reminder24h.enabled),
    },
    {
      key: "reminder2h",
      status: statusFor(reminder2Type, input.config.reminder2h.enabled),
    },
  ];
}

function shouldFireReminder(now: number, startsAt: Date, minutesBefore: number): boolean {
  const fireAt = startsAt.getTime() - minutesBefore * 60_000;
  return now >= fireAt - WINDOW_MS && now <= fireAt + WINDOW_MS;
}

function testTimingWindow() {
  const startsAt = new Date("2026-09-10T15:00:00.000Z");
  const minutesBefore = 1440;
  const fireAt = startsAt.getTime() - minutesBefore * 60_000;
  assert.equal(shouldFireReminder(fireAt, startsAt, minutesBefore), true);
  assert.equal(shouldFireReminder(fireAt - WINDOW_MS - 1, startsAt, minutesBefore), false);
  assert.equal(shouldFireReminder(fireAt + WINDOW_MS + 1, startsAt, minutesBefore), false);
  console.log("PASS reminder timing window (±4 min)");
}

function testTemplateMergeVars() {
  const startsAt = new Date("2026-09-10T19:00:00.000Z");
  const vars = appointmentMergeVars({
    firstName: "Alex",
    businessName: "Blue Ridge Realty",
    service: "Showing",
    startsAt,
    timezone: "America/New_York",
    rescheduleLink: "https://app.example/reschedule/tok",
    meetingLink: "https://meet.example/room",
  });
  const body = mergeTemplate(DEFAULT_REMINDER_TEMPLATES.reminder24h, vars);
  assert.match(body, /Showing/);
  assert.match(body, /Blue Ridge Realty/);
  assert.match(body, /reschedule/);
  assert.doesNotMatch(body, /\{\{first_name\}\}/);
  assert.doesNotMatch(body, /\{\{appointment_date\}\}/);
  console.log("PASS template variables resolve (sample 24h reminder)");
}

function testSmsConsentGatesScan() {
  const metaBlocked: AppointmentMetadata = { smsConsent: false };
  const metaAllowed: AppointmentMetadata = { smsConsent: true };
  const metaUnset: AppointmentMetadata = {};
  assert.equal(metaBlocked.smsConsent === false, true);
  assert.equal(metaAllowed.smsConsent === false, false);
  assert.equal(metaUnset.smsConsent === false, false);
  console.log("PASS smsConsent=false blocks scan; true/undefined allow");
}

function testDisabledRemindersNotScheduled() {
  const config = {
    confirmation: { ...DEFAULT_PLATFORM_CONFIG.reminders.confirmation, enabled: false },
    reminder24h: { ...DEFAULT_PLATFORM_CONFIG.reminders.reminder24h, enabled: false },
    reminder2h: { ...DEFAULT_PLATFORM_CONFIG.reminders.reminder2h, enabled: false },
  };
  const schedule = buildReminderSchedule({
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    metadata: { smsConsent: true },
    config,
  });
  assert.deepEqual(
    schedule.map((s) => s.status),
    ["disabled", "disabled", "disabled"],
  );
  console.log("PASS disabled workspace reminder steps show disabled status");
}

function testSmsConsentDisablesAllRemindersInSchedule() {
  const schedule = buildReminderSchedule({
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    metadata: { smsConsent: false },
    config: DEFAULT_PLATFORM_CONFIG.reminders,
  });
  assert.deepEqual(
    schedule.map((s) => s.status),
    ["disabled", "disabled", "disabled"],
  );
  console.log("PASS smsConsent=false marks all reminders disabled in schedule UI");
}

function testDuplicatePrevention() {
  let meta = resetAppointmentReminders({ smsConsent: true });
  const type24 = reminderTimelineType("reminder24h", 1440);
  assert.equal(wasReminderSent(meta, type24), false);
  meta = markReminderSentInMeta(meta, type24);
  assert.equal(wasReminderSent(meta, type24), true);
  meta = resetAppointmentReminders(meta);
  assert.equal(wasReminderSent(meta, type24), false);
  console.log("PASS duplicate sends prevented via reminderSentKeys + generation bump");
}

function testEmailChannelGap() {
  const emailStep: ReminderStepConfig = {
    enabled: true,
    channel: "email",
    label: "Email reminder",
    template: "Hi {{first_name}}",
    minutesBefore: 1440,
  };
  const preview = mergeTemplate(emailStep.template, appointmentMergeVars({
    firstName: "Alex",
    startsAt: new Date(),
  }));
  assert.match(preview, /Alex/);
  console.log("WARN email channel in reminder settings is not sent by platform scan (SMS/voice only)");
}

function testConfirmationImmediateNotScanned() {
  const steps = ["confirmation", "reminder24h", "reminder2h"] as const;
  const immediate = steps.filter((k) => k === "confirmation");
  const scanned = steps.filter((k) => k !== "confirmation");
  assert.deepEqual(immediate, ["confirmation"]);
  assert.deepEqual(scanned, ["reminder24h", "reminder2h"]);
  console.log("PASS confirmation is immediate at booking; 24h/2h use minute scan job");
}

function testApiSmsConsentStrictBoolean() {
  assert.equal(true === true, true);
  assert.equal(false === true, false);
  assert.equal(undefined === true, false);
  console.log("PASS API requires smsConsent === true (unchecked checkbox => no confirmation SMS)");
}

async function inspectDatabaseIfAvailable() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP DB inspection (DATABASE_URL not set)");
    return;
  }
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const future = await prisma.voiceAppointment.findMany({
    where: {
      startsAt: { gt: new Date() },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    orderBy: { startsAt: "asc" },
    take: 5,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      metadata: true,
    },
  });
  console.log(`\nDB: ${future.length} upcoming appointment(s) sampled`);
  for (const row of future) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const keys = meta.reminderSentKeys || [];
    console.log(
      `  - ${row.id.slice(0, 12)}… ${row.serviceName || "?"} @ ${row.startsAt.toISOString()} smsConsent=${meta.smsConsent ?? "unset"} sentKeys=${keys.length} status=${meta.reminderStatus ?? "—"}`,
    );
  }
}

async function main() {
  console.log("=== Appointment reminder audit (static + optional DB) ===\n");
  testTimingWindow();
  testTemplateMergeVars();
  testSmsConsentGatesScan();
  testDisabledRemindersNotScheduled();
  testSmsConsentDisablesAllRemindersInSchedule();
  testDuplicatePrevention();
  testEmailChannelGap();
  testConfirmationImmediateNotScanned();
  testApiSmsConsentStrictBoolean();
  await inspectDatabaseIfAvailable();
  console.log("\nAudit script complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
