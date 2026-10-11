/**
 * Appointment Reminders automated matrix (code-level). Requires DATABASE_URL for DB-backed cases.
 */
import assert from "node:assert/strict";
import { resolveEffectiveReminderPhone } from "@/lib/appointment-reminders/effective-phone";
import { evaluateSmsReminderEligibility } from "@/lib/appointment-reminders/sms-eligibility";
import { finalizeReminderSmsBody } from "@/lib/appointment-reminders/message-sanitize";
import { defaultArPermissionsForRole } from "@/lib/appointment-reminders/permissions-roles";
import { mapSmsReminderTimelineOutcome } from "@/lib/appointment-reminders/sms-reminder-timeline";

const meta = {
  inviteePhone: "+15551234567",
  smsConsent: true,
  reminderOverride: { phone: "+15559876543" },
} as import("@/lib/appointments/types").AppointmentMetadata;

assert.equal(
  resolveEffectiveReminderPhone(meta, "+15551234567", null),
  "+15559876543",
);

assert.equal(
  evaluateSmsReminderEligibility({
    metadata: meta,
    appointmentStatus: "confirmed",
  }).eligible,
  true,
);

assert.equal(
  evaluateSmsReminderEligibility({
    metadata: { ...meta, smsConsent: false },
    appointmentStatus: "confirmed",
  }).eligible,
  false,
);

assert.ok(!finalizeReminderSmsBody("Hello {{manage_link}}").includes("{{manage_link}}"));

assert.ok(defaultArPermissionsForRole("admin").includes("appointment_reminders.settings"));

assert.equal(mapSmsReminderTimelineOutcome("reminder_1440m_sent").status, "sent");

async function dbSection() {
  const {
    requireIsolatedArTestDatabase,
    ArTestDatabaseSkip,
  } = await import("./cloud-agent/ar-test-database-guard");
  try {
    requireIsolatedArTestDatabase();
  } catch (err) {
    if (err instanceof ArTestDatabaseSkip) {
      console.log(`SKIP DB section — ${err.message}`);
      return;
    }
    throw err;
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const ws = await prisma.workspace.findFirst({ select: { id: true } });
  assert.ok(ws?.id, "need at least one workspace for isolation smoke");

  const { resolveArMonthlySmsLimit } = await import(
    "@/lib/appointment-reminders/ar-commercial-entitlements"
  );
  const limit = await resolveArMonthlySmsLimit(ws.id);
  assert.ok(limit.limit >= 0);
  assert.ok(limit.source.length > 0);

  const { getArSmsUsageSnapshot } = await import("@/lib/appointment-reminders/ar-sms-usage");
  const snap = await getArSmsUsageSnapshot(ws.id);
  assert.ok(
    /^\d{4}-\d{2}$/.test(snap.periodKey) || snap.periodKey.includes("__"),
    `unexpected periodKey ${snap.periodKey}`,
  );
}

dbSection()
  .then(() => {
    console.log("test-appointment-reminders-ar-matrix.ts: PASS");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
