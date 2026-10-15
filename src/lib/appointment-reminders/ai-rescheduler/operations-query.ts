import type { Prisma } from "@prisma/client";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export const AR_RESCHEDULER_OPERATIONS_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

const PENDING_RESCHEDULE_STATUSES = new Set([
  "pending_approval",
  "pending_business",
  "processing",
]);

export type ReschedulerOperationsMetadata = AppointmentMetadata & {
  arRescheduleRequest?: { status?: string; requestedAt?: string };
  arReconcilePending?: { operationId?: string; proposedStartsAt?: string };
};

/**
 * Prisma where for AI Rescheduler operations panel.
 * Includes recently modified rows OR any row with active reschedule / reconcile metadata
 * (pending work must not be dropped when startsAt is in the past).
 */
export function buildAiReschedulerOperationsWhere(
  workspaceId: string,
  since: Date,
): Prisma.VoiceAppointmentWhereInput {
  return {
    workspaceId,
    OR: [
      { updatedAt: { gte: since } },
      { metadata: { path: ["arReconcilePending"], not: null } },
      { metadata: { path: ["arRescheduleRequest"], not: null } },
    ],
  };
}

export function buildReconcilePendingScanWhere(): Prisma.VoiceAppointmentWhereInput {
  return {
    metadata: { path: ["arReconcilePending"], not: null },
  };
}

/** Mirrors fetch predicate for unit tests (must stay aligned with buildAiReschedulerOperationsWhere). */
export function rowMatchesAiReschedulerOperationsWhere(
  row: { updatedAt: Date; metadata: unknown },
  since: Date,
): boolean {
  if (row.updatedAt >= since) return true;
  const meta = (row.metadata || {}) as ReschedulerOperationsMetadata;
  if (meta.arReconcilePending?.operationId) return true;
  if (meta.arRescheduleRequest) return true;
  return false;
}

export function rowHasPendingReschedulerApproval(meta: ReschedulerOperationsMetadata): boolean {
  const req = meta.arRescheduleRequest;
  return Boolean(req?.status && PENDING_RESCHEDULE_STATUSES.has(req.status));
}

export function rowHasReconcilePending(meta: ReschedulerOperationsMetadata): boolean {
  return Boolean(meta.arReconcilePending?.operationId);
}
