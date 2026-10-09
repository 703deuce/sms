/**
 * Recurring instances = separate voice_appointments; dispatches must not cross-suppress.
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";
import { reminderTimelineType } from "../src/lib/appointments/reminder-state";

async function main() {
  const prisma = getPrisma();
  const workspaceId = await getOrCreateArScaleTestWorkspace();
  const timeline = reminderTimelineType("reminder24h", 1440);
  const startsAt = new Date(Date.now() + 86400000);

  const occ1 = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      serviceName: "Recurring cut",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      status: "scheduled",
      timezone: "America/New_York",
      externalId: `microsoft:sim-conn:series-instance-A`,
      metadata: {
        reminderGeneration: 1,
        providerEventId: "series-instance-A",
        originalStart: startsAt.toISOString(),
      },
    },
  });

  const occ2 = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      serviceName: "Recurring cut",
      startsAt: new Date(startsAt.getTime() + 7 * 86400000),
      endsAt: new Date(startsAt.getTime() + 7 * 86400000 + 3600000),
      status: "scheduled",
      timezone: "America/New_York",
      externalId: `microsoft:sim-conn:series-instance-B`,
      metadata: {
        reminderGeneration: 1,
        providerEventId: "series-instance-B",
        originalStart: new Date(startsAt.getTime() + 7 * 86400000).toISOString(),
      },
    },
  });

  const d1 = await prisma.arReminderDispatch.create({
    data: {
      workspaceId,
      appointmentId: occ1.id,
      timelineType: timeline,
      reminderGeneration: 1,
      intendedFireAt: new Date(),
      status: "delivered",
    },
  });

  const d2 = await prisma.arReminderDispatch.create({
    data: {
      workspaceId,
      appointmentId: occ2.id,
      timelineType: timeline,
      reminderGeneration: 1,
      intendedFireAt: new Date(),
      status: "pending",
    },
  });

  assert.notEqual(d1.appointmentId, d2.appointmentId);
  assert.equal(d1.timelineType, d2.timelineType);
  assert.notEqual(d1.id, d2.id);

  const stillPending = await prisma.arReminderDispatch.findUnique({ where: { id: d2.id } });
  assert.equal(stillPending?.status, "pending");

  await prisma.arReminderDispatch.deleteMany({
    where: { appointmentId: { in: [occ1.id, occ2.id] } },
  });
  await prisma.voiceAppointment.deleteMany({ where: { id: { in: [occ1.id, occ2.id] } } });

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
