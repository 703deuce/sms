import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import {
  currentMctbRecoveryPeriodKey,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
} from "@/lib/mctb/recovery-usage-constants";

export { currentMctbRecoveryPeriodKey, MCTB_FREE_MONTHLY_RECOVERY_LIMIT };

const USAGE_PERIOD_KEY = "mctbRecoveriesPeriodKey";
const USAGE_USED = "mctbRecoveriesUsed";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type MctbRecoveryUsageSnapshot = {
  periodKey: string;
  usedInPeriod: number;
  limit: number | null;
  atLimit: boolean;
};

export async function getMctbRecoveryUsageSnapshot(
  workspaceId: string,
): Promise<MctbRecoveryUsageSnapshot> {
  const paid = await hasActiveMctbPaidEntitlement(workspaceId);
  const periodKey = currentMctbRecoveryPeriodKey();
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const storedPeriod = String(limits[USAGE_PERIOD_KEY] || "");
  let used = Number(limits[USAGE_USED] || 0);
  if (storedPeriod !== periodKey) used = 0;

  const limit = paid ? null : MCTB_FREE_MONTHLY_RECOVERY_LIMIT;
  const atLimit = limit != null && used >= limit;

  return { periodKey, usedInPeriod: used, limit, atLimit };
}

export type MctbRecoveryReservationResult = {
  reserved: boolean;
  used: number;
  limit: number | null;
  reason?: "paid_unlimited" | "mctb_recovery_limit_reached" | "setup_test_excluded";
};

/**
 * Reserve one MCTB_RECOVERY unit at recovery send time (not per SMS segment).
 * Idempotent replays must not call this twice for the same missed-call event.
 */
export async function reserveMctbRecoveryUnit(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
  excludeFromUsage?: boolean;
}): Promise<MctbRecoveryReservationResult> {
  if (input.excludeFromUsage) {
    return { reserved: true, used: 0, limit: null, reason: "setup_test_excluded" };
  }

  const paid = await hasActiveMctbPaidEntitlement(input.workspaceId);
  if (paid) {
    return { reserved: true, used: 0, limit: null, reason: "paid_unlimited" };
  }

  const periodKey = currentMctbRecoveryPeriodKey();
  const limit = MCTB_FREE_MONTHLY_RECOVERY_LIMIT;
  const prisma = getPrisma();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<Array<{ limits: unknown }>>`
      SELECT limits FROM workspace_limits WHERE workspace_id = ${input.workspaceId} FOR UPDATE
    `;

    const limits = asRecord(rows[0]?.limits);
    let used = Number(limits[USAGE_USED] || 0);
    const storedPeriod = String(limits[USAGE_PERIOD_KEY] || "");
    if (storedPeriod !== periodKey) {
      used = 0;
    }

    if (used >= limit) {
      return { reserved: false, used, limit, reason: "mctb_recovery_limit_reached" };
    }

    const nextUsed = used + 1;
    const nextLimits = {
      ...limits,
      [USAGE_PERIOD_KEY]: periodKey,
      [USAGE_USED]: nextUsed,
    };

    if (rows.length === 0) {
      await tx.workspaceLimits.create({
        data: { workspaceId: input.workspaceId, limits: nextLimits },
      });
    } else {
      await tx.workspaceLimits.update({
        where: { workspaceId: input.workspaceId },
        data: { limits: nextLimits },
      });
    }

    return { reserved: true, used: nextUsed, limit };
  });
}

/** Release reservation when provider send fails after reserve (mirrors trial SMS release). */
export async function releaseMctbRecoveryReservation(workspaceId: string): Promise<void> {
  const paid = await hasActiveMctbPaidEntitlement(workspaceId);
  if (paid) return;

  const periodKey = currentMctbRecoveryPeriodKey();
  const prisma = getPrisma();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<Array<{ limits: unknown }>>`
      SELECT limits FROM workspace_limits WHERE workspace_id = ${workspaceId} FOR UPDATE
    `;
    if (!rows.length) return;
    const limits = asRecord(rows[0]?.limits);
    if (String(limits[USAGE_PERIOD_KEY] || "") !== periodKey) return;
    const used = Math.max(0, Number(limits[USAGE_USED] || 0) - 1);
    await tx.workspaceLimits.update({
      where: { workspaceId },
      data: { limits: { ...limits, [USAGE_USED]: used } },
    });
  });
}
