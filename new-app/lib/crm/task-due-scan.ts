/**
 * Scheduled evaluation for CRM task.due / task.overdue automation triggers.
 * Providers rarely emit these as realtime webhooks — Transovo scans IntegrationTask rows.
 */

import { getPrisma } from "@/lib/server/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { makeEventIdempotencyKey } from "@/lib/integrations/framework/events";
import { CRM_PROVIDER_IDS } from "./registry";

const DUE_WINDOWS_MINUTES = [0, 15, 60, 1440] as const;

export async function scanCrmTasksDueAndOverdue() {
  const prisma = getPrisma();
  const now = Date.now();
  let enqueued = 0;

  // Due soon / due now windows (idempotent per task + window)
  for (const minutes of DUE_WINDOWS_MINUTES) {
    const windowStart = new Date(now + minutes * 60_000 - 2 * 60_000);
    const windowEnd = new Date(now + minutes * 60_000 + 2 * 60_000);
    const rows = await prisma.integrationTask.findMany({
      where: {
        provider: { in: [...CRM_PROVIDER_IDS] },
        contactId: { not: null },
        dueAt: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["completed", "done", "cancelled", "canceled"] },
      },
      take: 200,
    });

    for (const task of rows) {
      if (!task.contactId) continue;
      const externalId = task.externalId || task.id;
      const idempotencyKey = makeEventIdempotencyKey(
        task.provider,
        `${externalId}:due:${minutes}`,
        "task.due",
      );
      try {
        await enqueueJob({
          jobType: "integration_automation_event",
          queueName: `crm-${task.provider}`,
          workspaceId: task.workspaceId,
          priority: 30,
          idempotencyKey: `crm-task-due-${idempotencyKey}`,
          payload: {
            workspaceId: task.workspaceId,
            provider: task.provider,
            eventType: "task.due",
            contactId: task.contactId,
            payload: {
              taskId: task.id,
              externalId,
              minutesBefore: minutes,
              dueAt: task.dueAt?.toISOString() || null,
              title: task.title,
              ownerExternalId: task.ownerExternalId,
              status: task.status,
            },
          },
        });
        enqueued += 1;
      } catch {
        // duplicate idempotency
      }
    }
  }

  // Overdue: dueAt in the past, still open (once per calendar day)
  const dayKey = new Date().toISOString().slice(0, 10);
  const overdue = await prisma.integrationTask.findMany({
    where: {
      provider: { in: [...CRM_PROVIDER_IDS] },
      contactId: { not: null },
      dueAt: { lt: new Date(now) },
      status: { notIn: ["completed", "done", "cancelled", "canceled"] },
    },
    take: 300,
  });

  for (const task of overdue) {
    if (!task.contactId || !task.dueAt) continue;
    const externalId = task.externalId || task.id;
    const idempotencyKey = makeEventIdempotencyKey(
      task.provider,
      `${externalId}:overdue:${dayKey}`,
      "task.overdue",
    );
    try {
      await enqueueJob({
        jobType: "integration_automation_event",
        queueName: `crm-${task.provider}`,
        workspaceId: task.workspaceId,
        priority: 30,
        idempotencyKey: `crm-task-overdue-${idempotencyKey}`,
        payload: {
          workspaceId: task.workspaceId,
          provider: task.provider,
          eventType: "task.overdue",
          contactId: task.contactId,
          payload: {
            taskId: task.id,
            externalId,
            dueAt: task.dueAt.toISOString(),
            title: task.title,
            ownerExternalId: task.ownerExternalId,
            status: task.status,
          },
        },
      });
      enqueued += 1;
    } catch {
      // duplicate
    }
  }

  return { ok: true as const, enqueued };
}
