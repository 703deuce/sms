import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { resolveMctbCommercialEntitlements } from "@/lib/mctb/commercial-entitlements";
import { isOnboardingComplete } from "@/lib/mctb/onboarding/completion";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import {
  currentMctbRecoveryPeriodKey,
  mctbRecoveryPeriodUtcBounds,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  resolveMctbMonthlyRecoveryLimit,
} from "@/lib/mctb/recovery-usage-constants";

export {
  currentMctbRecoveryPeriodKey,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  resolveMctbMonthlyRecoveryLimit,
  MCTB_PAID_RECOVERY_LIMIT_BY_TIER,
  MCTB_PAID_RECOVERY_LIMIT_FALLBACK,
} from "@/lib/mctb/recovery-usage-constants";

const USAGE_PERIOD_KEY = "mctbRecoveriesPeriodKey";
const USAGE_USED = "mctbRecoveriesUsed";
const EVENT_META_RESERVED_PERIOD = "mctbRecoveryUsageReservedPeriod";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type MctbRecoveryUsageSnapshot = {
  periodKey: string;
  usedInPeriod: number;
  limit: number;
  atLimit: boolean;
};

function isTestRecoveryMetadata(metadata: unknown): boolean {
  const meta = asRecord(metadata);
  return (
    meta.liveTest === true ||
    meta.setupTest === true ||
    meta.excludeFromRecoveryUsage === true ||
    meta.testSms === true ||
    meta.setupSms === true
  );
}

/**
 * Setup / live-test traffic must not consume monthly recovery allowance (free 10 or paid 50/100).
 * Not gated on legacy `trialActivatedAt` — that field only records free-plan billing transition.
 */
export async function shouldExcludeMissedCallFromRecoveryUsage(input: {
  workspaceId: string;
  eventMetadata?: Record<string, unknown> | null;
  detectedAt?: Date | null;
}): Promise<boolean> {
  if (isTestRecoveryMetadata(input.eventMetadata)) return true;
  const onboarding = await loadMctbOnboardingState(input.workspaceId);
  const detectedAt = input.detectedAt ?? null;

  if (!isOnboardingComplete(onboarding)) return true;

  if (onboarding.liveTestSession?.startedAt && !onboarding.liveTestPassedAt) return true;

  if (
    detectedAt &&
    onboarding.liveTestPassedAt &&
    onboarding.liveTestSession?.startedAt
  ) {
    const sessionStart = new Date(onboarding.liveTestSession.startedAt);
    const sessionEnd = new Date(onboarding.liveTestPassedAt);
    if (detectedAt >= sessionStart && detectedAt <= sessionEnd) return true;
  }

  return false;
}

export async function buildMissedCallRecoveryUsageMetadata(
  workspaceId: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const onboarding = await loadMctbOnboardingState(workspaceId);
  const meta: Record<string, unknown> = { ...(extra || {}) };
  if (!isOnboardingComplete(onboarding)) {
    meta.excludeFromRecoveryUsage = true;
  }
  if (onboarding.liveTestSession?.startedAt && !onboarding.liveTestPassedAt) {
    meta.liveTest = true;
    meta.excludeFromRecoveryUsage = true;
  }
  return meta;
}

/**
 * Billable usage = missed calls where a recovery text was sent this period.
 * Customer replies and “recovered” outcomes do not affect the counter.
 */
async function countBillableRecoveryTextsSentInPeriod(
  workspaceId: string,
  periodKey: string,
): Promise<number> {
  const { start, end } = mctbRecoveryPeriodUtcBounds(periodKey);
  const prisma = getPrisma();
  const events = await prisma.missedCallEvent.findMany({
    where: {
      workspaceId,
      smsSentAt: { gte: start, lt: end },
    },
    select: { metadata: true, detectedAt: true, smsSentAt: true },
  });
  let count = 0;
  for (const event of events) {
    if (!event.smsSentAt) continue;
    const excluded = await shouldExcludeMissedCallFromRecoveryUsage({
      workspaceId,
      eventMetadata: asRecord(event.metadata),
      detectedAt: event.detectedAt,
    });
    if (!excluded) count += 1;
  }
  return count;
}

async function persistWorkspaceRecoveryUsed(
  workspaceId: string,
  periodKey: string,
  used: number,
  existingLimits?: Record<string, unknown>,
): Promise<void> {
  const prisma = getPrisma();
  const limits = existingLimits ?? asRecord(
    (
      await prisma.workspaceLimits.findUnique({
        where: { workspaceId },
        select: { limits: true },
      })
    )?.limits,
  );
  await prisma.workspaceLimits
    .upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        limits: { ...limits, [USAGE_PERIOD_KEY]: periodKey, [USAGE_USED]: used },
      },
      update: {
        limits: { ...limits, [USAGE_PERIOD_KEY]: periodKey, [USAGE_USED]: used },
      },
    })
    .catch(() => undefined);
}

export async function getMctbRecoveryUsageSnapshot(
  workspaceId: string,
): Promise<MctbRecoveryUsageSnapshot> {
  const commercial = await resolveMctbCommercialEntitlements(workspaceId);
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

  const textsSentInPeriod = await countBillableRecoveryTextsSentInPeriod(workspaceId, periodKey);
  if (textsSentInPeriod !== used) {
    used = textsSentInPeriod;
    await persistWorkspaceRecoveryUsed(workspaceId, periodKey, used, limits);
  }

  const limit = resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: commercial.mctbProductActive,
    recoveryPaid: commercial.recoveryPaid,
    aiRecoveryEntitled: commercial.aiRecoveryEntitled,
    paidTier: commercial.paidTier,
  });
  const atLimit = used >= limit;

  return { periodKey, usedInPeriod: used, limit, atLimit };
}

export type MctbRecoveryReservationResult = {
  reserved: boolean;
  used: number;
  limit: number;
  reason?: "mctb_recovery_limit_reached" | "setup_test_excluded" | "idempotent_replay";
};

async function markEventRecoveryReserved(
  tx: Prisma.TransactionClient,
  missedCallEventId: string,
  periodKey: string,
): Promise<void> {
  const event = await tx.missedCallEvent.findUnique({
    where: { id: missedCallEventId },
    select: { metadata: true },
  });
  if (!event) return;
  const meta = asRecord(event.metadata);
  if (meta[EVENT_META_RESERVED_PERIOD] === periodKey) return;
  await tx.missedCallEvent.update({
    where: { id: missedCallEventId },
    data: {
      metadata: {
        ...meta,
        [EVENT_META_RESERVED_PERIOD]: periodKey,
      },
    },
  });
}

async function eventAlreadyReservedThisPeriod(
  tx: Prisma.TransactionClient,
  missedCallEventId: string,
  periodKey: string,
): Promise<boolean> {
  const event = await tx.missedCallEvent.findUnique({
    where: { id: missedCallEventId },
    select: { metadata: true },
  });
  if (!event) return false;
  const meta = asRecord(event.metadata);
  return meta[EVENT_META_RESERVED_PERIOD] === periodKey;
}

/**
 * Reserve one MCTB_RECOVERY unit at recovery send time (not per SMS segment).
 * Retries/replayed webhooks for the same missed-call event reuse the reservation.
 */
export async function reserveMctbRecoveryUnit(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
  excludeFromUsage?: boolean;
  eventMetadata?: Record<string, unknown> | null;
}): Promise<MctbRecoveryReservationResult> {
  const excludeForTest =
    input.excludeFromUsage ||
    (await shouldExcludeMissedCallFromRecoveryUsage({
      workspaceId: input.workspaceId,
      eventMetadata: input.eventMetadata ?? null,
    }));
  if (excludeForTest) {
    const snap = await getMctbRecoveryUsageSnapshot(input.workspaceId);
    return {
      reserved: true,
      used: snap.usedInPeriod,
      limit: snap.limit,
      reason: "setup_test_excluded",
    };
  }

  const commercial = await resolveMctbCommercialEntitlements(input.workspaceId);
  const limit = resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: commercial.mctbProductActive,
    recoveryPaid: commercial.recoveryPaid,
    aiRecoveryEntitled: commercial.aiRecoveryEntitled,
    paidTier: commercial.paidTier,
  });

  const periodKey = currentMctbRecoveryPeriodKey();
  const prisma = getPrisma();
  const eventId = input.missedCallEventId?.trim() || null;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (eventId && (await eventAlreadyReservedThisPeriod(tx, eventId, periodKey))) {
      const limitsRow = await tx.workspaceLimits.findUnique({
        where: { workspaceId: input.workspaceId },
        select: { limits: true },
      });
      const limits = asRecord(limitsRow?.limits);
      let used = Number(limits[USAGE_USED] || 0);
      if (String(limits[USAGE_PERIOD_KEY] || "") !== periodKey) used = 0;
      return {
        reserved: true,
        used,
        limit,
        reason: "idempotent_replay",
      };
    }

    const limitsRow = await tx.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });

    const limits = asRecord(limitsRow?.limits);
    let used = Number(limits[USAGE_USED] || 0);
    const storedPeriod = String(limits[USAGE_PERIOD_KEY] || "");
    if (storedPeriod !== periodKey) {
      used = 0;
    }

    const textsSentInPeriod = await countBillableRecoveryTextsSentInPeriod(
      input.workspaceId,
      periodKey,
    );
    if (textsSentInPeriod > used) {
      used = textsSentInPeriod;
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

    await tx.workspaceLimits.upsert({
      where: { workspaceId: input.workspaceId },
      create: { workspaceId: input.workspaceId, limits: nextLimits },
      update: { limits: nextLimits },
    });

    if (eventId) {
      await markEventRecoveryReserved(tx, eventId, periodKey);
    }

    return { reserved: true, used: nextUsed, limit };
  });
}

/** Release reservation when provider send fails after reserve (mirrors trial SMS release). */
export async function releaseMctbRecoveryReservation(
  workspaceId: string,
  missedCallEventId?: string | null,
): Promise<void> {
  const periodKey = currentMctbRecoveryPeriodKey();
  const prisma = getPrisma();
  const eventId = missedCallEventId?.trim() || null;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (eventId) {
      const event = await tx.missedCallEvent.findUnique({
        where: { id: eventId },
        select: { metadata: true },
      });
      const meta = asRecord(event?.metadata);
      if (meta[EVENT_META_RESERVED_PERIOD] !== periodKey) {
        return;
      }
      const { [EVENT_META_RESERVED_PERIOD]: _removed, ...rest } = meta;
      await tx.missedCallEvent.update({
        where: { id: eventId },
        data: { metadata: rest },
      });
    }

    const limitsRow = await tx.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    });
    if (!limitsRow) return;
    const limits = asRecord(limitsRow.limits);
    if (String(limits[USAGE_PERIOD_KEY] || "") !== periodKey) return;
    const used = Math.max(0, Number(limits[USAGE_USED] || 0) - 1);
    await tx.workspaceLimits.update({
      where: { workspaceId },
      data: { limits: { ...limits, [USAGE_USED]: used } },
    });
  });
}
