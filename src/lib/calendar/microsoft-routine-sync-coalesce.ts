import "server-only";

import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { routineMicrosoftCalendarSyncIdempotencyKey } from "@/lib/calendar/microsoft-routine-sync-eligibility";

const JOB = "calendar_connection_sync";

export async function findOutstandingCalendarConnectionSync(connectionId: string) {
  const prisma = getPrisma();
  return prisma.jobQueue.findFirst({
    where: {
      jobType: JOB,
      status: { in: ["pending", "deferred", "processing"] },
      idempotencyKey: { startsWith: `calendar-sync-${connectionId}-` },
    },
    select: { id: true, idempotencyKey: true, status: true },
  });
}

export async function setMicrosoftRoutineSyncDeferred(
  workspaceId: string,
  connectionId: string,
  deferred = true,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
    select: { config: true },
  });
  if (!row) return;
  const config = { ...((row.config || {}) as CalendarConfig) };
  if (deferred) {
    config.microsoftRoutineSyncDeferred = true;
  } else {
    delete config.microsoftRoutineSyncDeferred;
  }
  await prisma.voiceCalendarConnection.update({
    where: { id: connectionId },
    data: { config: config as object },
  });
}

/** After a successful sync, honor a deferred flag with one coalesced routine job. */
export async function maybeEnqueueDeferredRoutineCalendarSync(
  workspaceId: string,
  connectionId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
    select: { config: true },
  });
  const config = (row?.config || {}) as CalendarConfig;
  if (!config.microsoftRoutineSyncDeferred) return;

  const outstanding = await findOutstandingCalendarConnectionSync(connectionId);
  if (outstanding) return;

  const { enqueueCalendarConnectionSync } = await import("@/lib/calendar/import-sync");
  await enqueueCalendarConnectionSync(workspaceId, connectionId, true, {
    priority: 25,
    wake: true,
    scheduling: "routine_reconcile",
  });
  await setMicrosoftRoutineSyncDeferred(workspaceId, connectionId, false);
}

export { routineMicrosoftCalendarSyncIdempotencyKey };
