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
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
        contactId: { not: null },
        NOT: { metadata: { path: ["noShow"], equals: true } },
      },
      take: 200,
    });

    for (const appt of rows) {
      if (!appt.contactId) continue;
      if (
        appt.status === "no_show" ||
        (appt.metadata as { noShow?: unknown } | null)?.noShow === true
      ) {
        continue;
      }
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
      // Never auto-complete cancellations, already-completed rows, or no-shows.
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      contactId: { not: null },
      NOT: { metadata: { path: ["noShow"], equals: true } },
    },
    take: 200,
  });

  for (const appt of rows) {
    if (!appt.contactId || !appt.endsAt) continue;
    // Defensive: skip no-shows even if the DB filter missed a legacy row shape.
    if (
      appt.status === "no_show" ||
      (appt.metadata as { noShow?: unknown } | null)?.noShow === true
    ) {
      continue;
    }
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
      // enqueueJob resolves for both a fresh enqueue and a duplicate idempotency
      // key; it only throws on a real backend failure. Marking the row completed
      // only after it resolves guarantees we never drop the completion event.
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

      // Mark completed only after a successful enqueue so a backend failure lets
      // the row be re-scanned next tick instead of silently swallowing the event.
      await prisma.voiceAppointment
        .update({ where: { id: appt.id }, data: { status: "completed" } })
        .catch(() => undefined);
    } catch {
      // Enqueue failed — leave the row untouched so the next scan retries it.
    }
  }

  return { ok: true, enqueued };
}
