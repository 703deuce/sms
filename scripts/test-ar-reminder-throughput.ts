/**
 * Simulated due-reminder discovery + mock dispatch (no real Telnyx).
 * Usage: npx tsx scripts/test-ar-reminder-throughput.ts --count=600
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";

const count = Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] || 600);
const BATCH = Number(process.env.AR_THROUGHPUT_INSERT_BATCH || 100);

async function withDbRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      console.warn(`[throughput] ${label} retry ${i + 1}/${attempts}`, err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function main() {
  const prisma = getPrisma();
  const workspaceId = await getOrCreateArScaleTestWorkspace();
  const runId = String(Date.now());
  const idPrefix = `sim-ar-appt-${runId}-`;

  await prisma.arReminderDispatch.deleteMany({ where: { workspaceId } }).catch(() => undefined);
  for (;;) {
    const staleAppts = await prisma.voiceAppointment.findMany({
      where: { workspaceId },
      select: { id: true },
      take: BATCH,
    });
    if (!staleAppts.length) break;
    const chunk = staleAppts.map((r) => r.id);
    await prisma.voiceAppointment.deleteMany({ where: { id: { in: chunk } } }).catch(() => undefined);
  }

  process.env.AR_REMINDER_DISPATCH_TEST_MOCK = "1";
  process.env.AR_REMINDER_DISPATCH_TEST_WORKSPACE = workspaceId;
  process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE = workspaceId;
  process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE = "1";

  const minutesBefore = 1440;
  const startsAt = new Date(Date.now() + minutesBefore * 60_000 + 60_000);
  const endsAt = new Date(startsAt.getTime() + 3600000);
  const ids: string[] = [];

  const dataCreateStart = Date.now();
  for (let offset = 0; offset < count; offset += BATCH) {
    const slice = Math.min(BATCH, count - offset);
    const batch = Array.from({ length: slice }, (_, i) => {
      const n = offset + i;
      const id = `${idPrefix}${n}`;
      ids.push(id);
      return {
        id,
        workspaceId,
        serviceName: "Scale test",
        startsAt,
        endsAt,
        status: "scheduled",
        timezone: "America/New_York",
        metadata: {
          reminderGeneration: 1,
          inviteePhone: "+15555550123",
          reminderSmsEligible: true,
        },
      };
    });
    const { count: inserted } = await prisma.voiceAppointment.createMany({ data: batch });
    assert.equal(inserted, slice, `createMany batch at offset ${offset}`);
  }
  const dataCreateMs = Date.now() - dataCreateStart;
  const apptCount = await prisma.voiceAppointment.count({ where: { workspaceId } });
  assert.equal(apptCount, count, `expected ${count} appointments in scale workspace, found ${apptCount}`);

  const discoveryStart = Date.now();
  const { discoverAndEnqueueDueAppointmentReminders } = await import(
    "../src/lib/appointment-reminders/reminder-discovery"
  );
  let totalEnqueued = 0;
  let totalExamined = 0;
  let totalSuppressedLate = 0;
  let ticks = 0;
  while (ticks < 80) {
    const r = await discoverAndEnqueueDueAppointmentReminders();
    totalEnqueued += r.enqueued;
    totalExamined += r.examined;
    totalSuppressedLate += r.suppressedLate;
    ticks += 1;
    if (ticks % 5 === 0 || r.enqueued > 0) {
      console.log(
        `[throughput] discovery tick ${ticks}`,
        JSON.stringify({ enqueued: r.enqueued, examined: r.examined, totalEnqueued }),
      );
    }
    const dueForRun = await withDbRetry("dispatch count", () =>
      prisma.arReminderDispatch.count({
        where: { workspaceId, appointmentId: { startsWith: idPrefix } },
      }),
    );
    if (dueForRun >= count) break;
    if (r.enqueued === 0 && r.examined === 0) break;
  }
  const discoveryMs = Date.now() - discoveryStart;
  const dispatchRowsForRun = await withDbRetry("dispatch count final", () =>
    prisma.arReminderDispatch.count({
      where: { workspaceId, appointmentId: { startsWith: idPrefix } },
    }),
  );

  const statusAfterDiscovery = await prisma.arReminderDispatch.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });

  const dispatchStart = Date.now();
  const dispatches = await prisma.arReminderDispatch.findMany({
    where: { workspaceId, status: "pending", appointmentId: { startsWith: idPrefix } },
    take: count * 4,
    select: { id: true },
  });
  const { executeArReminderDispatchJob } = await import(
    "../src/lib/appointment-reminders/reminder-dispatch-executor"
  );
  let dispatched = 0;
  let dispatchFailed = 0;
  for (const d of dispatches) {
    const res = await executeArReminderDispatchJob({ dispatchId: d.id });
    if (res.ok) dispatched += 1;
    else dispatchFailed += 1;
  }
  const dispatchMs = Date.now() - dispatchStart;

  const unknown = await prisma.arReminderDispatch.count({
    where: { workspaceId, status: "unknown" },
  });
  const duplicateAttempt = dispatches[0]
    ? await executeArReminderDispatchJob({ dispatchId: dispatches[0].id })
    : null;

  console.log(
    JSON.stringify(
      {
        count,
        insertBatchSize: BATCH,
        dataCreateMs,
        discoveryMs,
        discoveryTicks: ticks,
        totalExamined,
        totalEnqueued,
        dispatchRowsForRun,
        suppressedLate: totalSuppressedLate,
        dispatchRowsByStatusAfterDiscovery: statusAfterDiscovery,
        mockDispatched: dispatched,
        dispatchFailed,
        dispatchMs,
        unknown,
        duplicateReExecuteOk: duplicateAttempt?.ok ?? null,
      },
      null,
      2,
    ),
  );

  assert.ok(dispatchRowsForRun >= count, `expected ${count} dispatch rows, got ${dispatchRowsForRun}`);
  assert.equal(unknown, 0);
  assert.equal(dispatchFailed, 0, "expected zero mock dispatch failures");
  assert.ok(dispatched >= count, `expected at least ${count} mock dispatches, got ${dispatched}`);

  await prisma.arReminderDispatch.deleteMany({ where: { workspaceId } }).catch(() => undefined);
  await prisma.voiceAppointment.deleteMany({
    where: { workspaceId, id: { startsWith: idPrefix } },
  }).catch(() => undefined);

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
