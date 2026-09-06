#!/usr/bin/env tsx
import { getPrisma } from "../src/lib/db";
import { reminderTimelineType } from "../src/lib/appointments/reminder-state";
import type { AppointmentMetadata, ReminderStepConfig } from "../src/lib/appointments/types";
import { DEFAULT_PLATFORM_CONFIG } from "../src/lib/appointments/types";

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

  const statusFor = (timelineType: string, enabled: boolean) => {
    if (!enabled) return "disabled";
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

async function loadReminders(workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: "appointments-platform" },
    orderBy: { updatedAt: "desc" },
  });
  const stored = (row?.configJson || {}) as { reminders?: typeof DEFAULT_PLATFORM_CONFIG.reminders };
  return {
    ...DEFAULT_PLATFORM_CONFIG.reminders,
    ...(stored.reminders || {}),
  };
}

async function main() {
  const prisma = getPrisma();
  const ids = ["cmtpc8ki15w3e5s3y2h155z28", "cmtpd24dr3c503k585c6k2y40"];
  for (const id of ids) {
    const row = await prisma.voiceAppointment.findUnique({ where: { id } });
    if (!row) {
      console.log("missing", id);
      continue;
    }
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const reminders = await loadReminders(row.workspaceId);
    const schedule = buildReminderSchedule({
      startsAt: row.startsAt.toISOString(),
      metadata: meta,
      config: reminders,
    });
    const ws = await prisma.workspace.findUnique({
      where: { id: row.workspaceId },
      select: { slug: true, displayName: true, name: true },
    });
    console.log("\n===", meta.inviteeName, `(${id}) ===`);
    console.log("workspace:", ws?.displayName || ws?.name, ws?.slug);
    console.log("startsAt:", row.startsAt.toISOString());
    console.log("smsConsent:", meta.smsConsent);
    console.log("reminderSchedule:", schedule);
    console.log("timeline:", (meta.timeline || []).map((t) => `${t.type}`).join(", ") || "(none)");
    console.log("confirmation enabled:", reminders.confirmation.enabled);
    console.log("24h enabled:", reminders.reminder24h.enabled);
    console.log("2h enabled:", reminders.reminder2h.enabled);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
