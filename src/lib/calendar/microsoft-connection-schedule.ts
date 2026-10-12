import "server-only";

import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import {
  microsoftCalendarReconcileIntervalMinutes,
  microsoftSyncEnqueueLeaseMs,
  microsoftSyncFailureBackoffMs,
} from "@/lib/calendar/microsoft-schedule-config";

export function staggerInitialMicrosoftSyncDueAt(connectionId: string, now = new Date()): Date {
  const hash = createHash("sha256").update(connectionId).digest();
  const bucketSec = hash.readUInt32BE(0) % (microsoftCalendarReconcileIntervalMinutes() * 60);
  return new Date(now.getTime() + bucketSec * 1000);
}

export function nextMicrosoftSyncDueAfterSuccess(now = new Date()): Date {
  return new Date(now.getTime() + microsoftCalendarReconcileIntervalMinutes() * 60_000);
}

export async function ensureMicrosoftConnectionScheduleInitialized(connectionId: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceCalendarConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, provider: true, nextSyncDueAt: true },
  });
  if (!row || row.provider !== "microsoft" || row.nextSyncDueAt) return;
  await prisma.voiceCalendarConnection.update({
    where: { id: connectionId },
    data: { nextSyncDueAt: staggerInitialMicrosoftSyncDueAt(connectionId) },
  });
}

export async function markMicrosoftSyncEnqueueLease(connectionIds: string[]) {
  if (!connectionIds.length) return;
  const prisma = getPrisma();
  const leaseUntil = new Date(Date.now() + microsoftSyncEnqueueLeaseMs());
  await prisma.voiceCalendarConnection.updateMany({
    where: { id: { in: connectionIds }, provider: "microsoft" },
    data: { nextSyncDueAt: leaseUntil },
  });
}

export async function markMicrosoftSyncSuccess(connectionId: string) {
  const prisma = getPrisma();
  await prisma.voiceCalendarConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      nextSyncDueAt: nextMicrosoftSyncDueAfterSuccess(),
      syncBackoffUntil: null,
      status: "connected",
    },
  });
}

export async function markMicrosoftSyncFailure(connectionId: string, attemptHint = 1) {
  const prisma = getPrisma();
  const backoffMs = microsoftSyncFailureBackoffMs(attemptHint);
  const backoffUntil = new Date(Date.now() + backoffMs);
  await prisma.voiceCalendarConnection.update({
    where: { id: connectionId },
    data: {
      syncBackoffUntil: backoffUntil,
      nextSyncDueAt: backoffUntil,
    },
  });
}

export type MicrosoftSyncScheduleMetrics = {
  dueDiscovered: number;
  enqueued: number;
  skippedBackoff: number;
  skippedLease: number;
  skippedNoCredentials: number;
  skippedAlreadyQueued: number;
};

/** Push rediscovery out so needs_reauth rows without tokens are not scanned every tick. */
export async function markMicrosoftConnectionPausedForReauth(connectionId: string) {
  const prisma = getPrisma();
  const pauseUntil = new Date(Date.now() + 24 * 60 * 60_000);
  await prisma.voiceCalendarConnection.update({
    where: { id: connectionId },
    data: { nextSyncDueAt: pauseUntil },
  });
}
