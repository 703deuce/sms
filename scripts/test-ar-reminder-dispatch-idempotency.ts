/**
 * Unknown Telnyx/submission outcomes must not authorize blind resubmit.
 * Usage: npx tsx scripts/test-ar-reminder-dispatch-idempotency.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findFirst({ select: { id: true } });
  assert.ok(ws, "workspace required");

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ws.id,
      serviceName: "Test",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      status: "scheduled",
      timezone: "America/New_York",
      metadata: { reminderGeneration: 1, inviteePhone: "+15555550100" },
    },
  });

  const dispatch = await prisma.arReminderDispatch.create({
    data: {
      workspaceId: ws.id,
      appointmentId: appt.id,
      timelineType: "reminder_24h",
      reminderGeneration: 1,
      intendedFireAt: new Date(),
      status: "unknown",
      unknownSince: new Date(),
      lastError: "simulated_timeout",
      metadata: { stepKey: "reminder24h" },
    },
  });

  const { executeArReminderDispatchJob } = await import(
    "../src/lib/appointment-reminders/reminder-dispatch-executor"
  );

  const blocked = await executeArReminderDispatchJob({ dispatchId: dispatch.id });
  assert.equal(blocked.reason, "unknown_outcome_no_resubmit");

  const claimA = await prisma.arReminderDispatch.updateMany({
    where: { id: dispatch.id, status: "pending" },
    data: { status: "claimed", claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 60_000) },
  });
  await prisma.arReminderDispatch.update({
    where: { id: dispatch.id },
    data: { status: "pending", claimedAt: null, claimExpiresAt: null },
  });
  const claimB = await prisma.arReminderDispatch.updateMany({
    where: {
      id: dispatch.id,
      status: "pending",
      OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: new Date() } }],
    },
    data: { status: "claimed", claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 60_000) },
  });
  assert.equal(claimA.count + claimB.count, 1, "only one concurrent-style claim wins");

  await prisma.arReminderDispatch.delete({ where: { id: dispatch.id } });
  await prisma.voiceAppointment.delete({ where: { id: appt.id } });

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
