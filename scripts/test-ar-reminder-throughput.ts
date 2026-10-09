/**
 * Simulated due-reminder discovery + mock dispatch (no real Telnyx).
 * Usage: npx tsx scripts/test-ar-reminder-throughput.ts --count=600
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";

const count = Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] || 600);

async function main() {
  const prisma = getPrisma();
  const workspaceId = await getOrCreateArScaleTestWorkspace();
  await prisma.voiceAppointment.deleteMany({
    where: { workspaceId, id: { startsWith: "sim-ar-appt-" } },
  }).catch(() => undefined);
  await prisma.arReminderDispatch.deleteMany({ where: { workspaceId } }).catch(() => undefined);
  process.env.AR_REMINDER_DISPATCH_TEST_MOCK = "1";
  process.env.AR_REMINDER_DISPATCH_TEST_WORKSPACE = workspaceId;
  process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE = workspaceId;
  process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE = "1";

  const minutesBefore = 1440;
  const startsAt = new Date(Date.now() + minutesBefore * 60_000 + 60_000);
  const ids: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const id = `sim-ar-appt-${i}-${Date.now()}`;
    ids.push(id);
    await prisma.voiceAppointment.create({
      data: {
        id,
        workspaceId,
        serviceName: "Scale test",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3600000),
        status: "scheduled",
        timezone: "America/New_York",
        metadata: {
          reminderGeneration: 1,
          inviteePhone: "+15555550123",
          reminderSmsEligible: true,
        },
      },
    });
  }

  const discoveryStart = Date.now();
  const { discoverAndEnqueueDueAppointmentReminders } = await import(
    "../src/lib/appointment-reminders/reminder-discovery"
  );
  let totalEnqueued = 0;
  let ticks = 0;
  while (ticks < 20 && totalEnqueued < count) {
    const r = await discoverAndEnqueueDueAppointmentReminders();
    totalEnqueued += r.enqueued;
    ticks += 1;
    if (r.enqueued === 0 && r.examined === 0) break;
  }
  const discoveryMs = Date.now() - discoveryStart;

  const pending = await prisma.arReminderDispatch.count({
    where: { workspaceId, status: { in: ["pending", "claimed", "submitting", "accepted"] } },
  });

  const dispatchStart = Date.now();
  const dispatches = await prisma.arReminderDispatch.findMany({
    where: { workspaceId, status: "pending" },
    take: Math.min(count, 500),
    select: { id: true },
  });
  const { executeArReminderDispatchJob } = await import(
    "../src/lib/appointment-reminders/reminder-dispatch-executor"
  );
  let dispatched = 0;
  for (const d of dispatches) {
    const res = await executeArReminderDispatchJob({ dispatchId: d.id });
    if (res.ok) dispatched += 1;
  }
  const dispatchMs = Date.now() - dispatchStart;

  const unknown = await prisma.arReminderDispatch.count({
    where: { workspaceId, status: "unknown" },
  });

  console.log(
    JSON.stringify({
      count,
      discoveryMs,
      discoveryTicks: ticks,
      totalEnqueued,
      pendingAfterDiscovery: pending,
      mockDispatchedSample: dispatched,
      dispatchSampleMs: dispatchMs,
      unknown,
    }),
  );

  assert.ok(totalEnqueued > 0, "expected some enqueued reminders");
  assert.equal(unknown, 0);

  await prisma.arReminderDispatch.deleteMany({ where: { workspaceId } }).catch(() => undefined);
  await prisma.voiceAppointment.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
