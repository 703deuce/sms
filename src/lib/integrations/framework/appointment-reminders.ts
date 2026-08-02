/**
 * Calendly/appointment "starting soon" triggers via Transovo scheduled jobs.
 * Calendly does not send these events — we evaluate VoiceAppointment rows.
 */

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { makeEventIdempotencyKey } from "./events";

const WINDOWS_MINUTES = [15, 30, 60, 120, 1440] as const;

/**
 * Scan upcoming appointments and enqueue automation events once per window.
 * Intended to run every few minutes from the in-process job drain / cron.
 */
export async function scanAppointmentsStartingSoon() {
  const prisma = getPrisma();
  const now = Date.now();
  let enqueued = 0;

  for (const minutes of WINDOWS_MINUTES) {
    const windowStart = new Date(now + minutes * 60_000 - 2 * 60_000);
    const windowEnd = new Date(now + minutes * 60_000 + 2 * 60_000);
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["canceled", "cancelled", "completed"] },
        contactId: { not: null },
      },
      take: 200,
    });

    for (const appt of rows) {
      if (!appt.contactId) continue;
      const provider =
        (typeof (appt.metadata as { provider?: string } | null)?.provider === "string"
          ? (appt.metadata as { provider: string }).provider
          : null) ||
        (appt.externalId?.startsWith("calendly:") ? "calendly" : "calendly");
      const externalId = appt.externalId || appt.id;
      const idempotencyKey = makeEventIdempotencyKey(
        provider,
        `${externalId}:starting_soon:${minutes}`,
        "appointment.starting_soon",
      );
      try {
        await enqueueJob({
          jobType: "integration_automation_event",
          queueName: `ext-${provider}`,
          workspaceId: appt.workspaceId,
          priority: 30,
          idempotencyKey: `appt-soon-${idempotencyKey}`,
          payload: {
            workspaceId: appt.workspaceId,
            provider,
            eventType: "appointment.starting_soon",
            contactId: appt.contactId,
            payload: {
              appointmentId: appt.id,
              externalId,
              minutesBefore: minutes,
              startsAt: appt.startsAt.toISOString(),
              serviceName: appt.serviceName,
              eventType: "appointment.starting_soon",
            },
          },
        });
        enqueued += 1;
      } catch {
        // duplicate idempotency — ignore
      }
    }
  }

  return { ok: true, enqueued };
}

/**
 * Scan appointments whose end time has passed and emit `appointment.completed`
 * exactly once, then mark the row completed so it is never re-scanned.
 *
 * Calendly does not deliver a "completed" event — this derives it from the
 * VoiceAppointment end time. Idempotency is enforced twice: by the enqueue
 * idempotency key AND by flipping the row status to "completed".
 */
export async function scanAppointmentsCompleted() {
  const prisma = getPrisma();
  const now = new Date();
  let enqueued = 0;

  const rows = await prisma.voiceAppointment.findMany({
    where: {
      endsAt: { not: null, lt: now },
      status: { notIn: ["canceled", "cancelled", "completed"] },
      contactId: { not: null },
    },
    take: 200,
  });

  for (const appt of rows) {
    if (!appt.contactId || !appt.endsAt) continue;
    const provider =
      (typeof (appt.metadata as { provider?: string } | null)?.provider === "string"
        ? (appt.metadata as { provider: string }).provider
        : null) ||
      (appt.externalId?.startsWith("calendly:") ? "calendly" : "calendly");
    const externalId = appt.externalId || appt.id;
    const idempotencyKey = makeEventIdempotencyKey(
      provider,
      `${externalId}:completed`,
      "appointment.completed",
    );
    try {
      await enqueueJob({
        jobType: "integration_automation_event",
        queueName: `ext-${provider}`,
        workspaceId: appt.workspaceId,
        priority: 30,
        idempotencyKey: `appt-completed-${idempotencyKey}`,
        payload: {
          workspaceId: appt.workspaceId,
          provider,
          eventType: "appointment.completed",
          contactId: appt.contactId,
          payload: {
            appointmentId: appt.id,
            externalId,
            startsAt: appt.startsAt.toISOString(),
            endsAt: appt.endsAt.toISOString(),
            serviceName: appt.serviceName,
            eventType: "appointment.completed",
          },
        },
      });
      enqueued += 1;
    } catch {
      // duplicate idempotency — still mark completed below to stop re-scanning
    }

    // Mark completed after enqueue so the row is not re-scanned next tick.
    await prisma.voiceAppointment
      .update({ where: { id: appt.id }, data: { status: "completed" } })
      .catch(() => undefined);
  }

  return { ok: true, enqueued };
}
