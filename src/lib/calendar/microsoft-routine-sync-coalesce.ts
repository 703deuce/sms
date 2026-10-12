import "server-only";

import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { routineMicrosoftCalendarSyncIdempotencyKey } from "@/lib/calendar/microsoft-routine-sync-eligibility";

const JOB = "calendar_connection_sync";

/** Jobs in processing longer than this do not block new routine enqueue (stale worker lock). */
export function calendarSyncStuckProcessingMs(): number {
  const raw = process.env.CALENDAR_SYNC_STUCK_PROCESSING_MS;
  const n = raw ? Number(raw) : 45 * 60_000;
  return Number.isFinite(n) && n > 60_000 ? n : 45 * 60_000;
}

export async function findOutstandingCalendarConnectionSync(connectionId: string) {
  const prisma = getPrisma();
  return prisma.jobQueue.findFirst({
    where: {
      jobType: JOB,
      status: { in: ["pending", "deferred", "processing"] },
      idempotencyKey: { startsWith: `calendar-sync-${connectionId}-` },
    },
    select: { id: true, idempotencyKey: true, status: true, lockedAt: true },
  });
}

/** Outstanding jobs that should block another routine enqueue (ignores stale processing locks). */
export async function findBlockingOutstandingCalendarConnectionSync(connectionId: string) {
  const row = await findOutstandingCalendarConnectionSync(connectionId);
  if (!row) return null;
  if (row.status === "processing" && row.lockedAt) {
    const ageMs = Date.now() - row.lockedAt.getTime();
    if (ageMs > calendarSyncStuckProcessingMs()) {
      return null;
    }
  }
  return row;
}

export async function connectionHasDeferredRoutineSync(
  workspaceId: string,
  connectionId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
    select: { config: true },
  });
  return Boolean((row?.config as CalendarConfig | undefined)?.microsoftRoutineSyncDeferred);
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

/**
 * When a calendar sync job reaches a terminal state (success or failure) or reconcile
 * finds deferred=true with no blocking outstanding job, enqueue one follow-up routine sync.
 */
export async function processDeferredRoutineCalendarSyncAfterJobTerminal(
  workspaceId: string,
  connectionId: string,
) {
  const hasDeferred = await connectionHasDeferredRoutineSync(workspaceId, connectionId);
  if (!hasDeferred) return { enqueued: false, reason: "not_deferred" as const };

  const blocking = await findBlockingOutstandingCalendarConnectionSync(connectionId);
  if (blocking) return { enqueued: false, reason: "still_blocking" as const };

  const { enqueueCalendarConnectionSync } = await import("@/lib/calendar/import-sync");
  await enqueueCalendarConnectionSync(workspaceId, connectionId, true, {
    priority: 25,
    wake: true,
    scheduling: "routine_reconcile",
  });
  await setMicrosoftRoutineSyncDeferred(workspaceId, connectionId, false);
  return { enqueued: true, reason: "follow_up_enqueued" as const };
}

/** @deprecated use processDeferredRoutineCalendarSyncAfterJobTerminal */
export async function maybeEnqueueDeferredRoutineCalendarSync(
  workspaceId: string,
  connectionId: string,
) {
  await processDeferredRoutineCalendarSyncAfterJobTerminal(workspaceId, connectionId);
}

export async function notifyCalendarConnectionSyncJobTerminal(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const connectionId = String(payload.connectionId || "");
  if (!workspaceId || !connectionId) return;
  await processDeferredRoutineCalendarSyncAfterJobTerminal(workspaceId, connectionId);
}

export { routineMicrosoftCalendarSyncIdempotencyKey };
