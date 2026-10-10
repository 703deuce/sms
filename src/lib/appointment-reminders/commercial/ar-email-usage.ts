import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveArMonthlyEmailLimit } from "@/lib/appointment-reminders/ar-commercial-entitlements";
import { getArCommercialUsagePeriodKey } from "@/lib/appointment-reminders/commercial/ar-usage-keys";
import { withArSmsMeteringLock } from "@/lib/appointment-reminders/ar-sms-usage-metering-lock";
import { shouldMeterAppointmentRemindersSms } from "@/lib/appointment-reminders/ar-sms-usage";

export const AR_EMAIL_USAGE_PERIOD_KEY = "arReminderEmailPeriodKey";
export const AR_EMAIL_USAGE_USED = "arReminderEmailUsed";
export const AR_EMAIL_USAGE_REVISION_KEY = "arReminderEmailUsageRevision";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readEmailUsed(limits: Record<string, unknown>, periodKey: string): number {
  const stored = String(limits[AR_EMAIL_USAGE_PERIOD_KEY] || "");
  let used = Number(limits[AR_EMAIL_USAGE_USED] || 0);
  if (stored !== periodKey) used = 0;
  return used;
}

export type ArEmailUsageSnapshot = {
  periodKey: string;
  usedInPeriod: number;
  limit: number;
  atLimit: boolean;
  meteringActive: boolean;
};

export async function getArEmailUsageSnapshot(workspaceId: string): Promise<ArEmailUsageSnapshot> {
  const meteringActive = await shouldMeterAppointmentRemindersSms(workspaceId);
  const periodKey = await getArCommercialUsagePeriodKey(workspaceId);
  const limit = await resolveArMonthlyEmailLimit(workspaceId);

  if (!meteringActive || limit <= 0) {
    return { periodKey, usedInPeriod: 0, limit, atLimit: false, meteringActive: false };
  }

  const row = await getPrisma().workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const used = readEmailUsed(limits, periodKey);
  return {
    periodKey,
    usedInPeriod: used,
    limit,
    atLimit: used >= limit,
    meteringActive: true,
  };
}

export type ArEmailReservationResult = {
  reserved: boolean;
  used: number;
  limit: number;
  reason?: "ar_email_limit_reached" | "idempotent_replay" | "metering_inactive";
};

export async function reserveArReminderEmailUnit(input: {
  workspaceId: string;
  idempotencyKey?: string | null;
}): Promise<ArEmailReservationResult> {
  const meteringActive = await shouldMeterAppointmentRemindersSms(input.workspaceId);
  const periodKey = await getArCommercialUsagePeriodKey(input.workspaceId);
  const limit = await resolveArMonthlyEmailLimit(input.workspaceId);

  if (!meteringActive || limit <= 0) {
    const snap = await getArEmailUsageSnapshot(input.workspaceId);
    return {
      reserved: true,
      used: snap.usedInPeriod,
      limit: snap.limit,
      reason: "metering_inactive",
    };
  }

  const idemKey = input.idempotencyKey?.trim() || null;
  const idemField = idemKey ? `arEmailReserved:${periodKey}:${idemKey}` : null;

  return withArSmsMeteringLock(input.workspaceId, async () => {
    const prisma = getPrisma();
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    const limits = asRecord(limitsRow?.limits);
    if (idemField && limits[idemField] === true) {
      const used = readEmailUsed(limits, periodKey);
      return { reserved: true, used, limit, reason: "idempotent_replay" };
    }

    let used = readEmailUsed(limits, periodKey);
    if (used + 1 > limit) {
      return { reserved: false, used, limit, reason: "ar_email_limit_reached" };
    }

    const nextUsed = used + 1;
    const revision = Number(limits[AR_EMAIL_USAGE_REVISION_KEY] || 0);
    const nextLimits: Record<string, unknown> = {
      ...limits,
      [AR_EMAIL_USAGE_PERIOD_KEY]: periodKey,
      [AR_EMAIL_USAGE_USED]: nextUsed,
      [AR_EMAIL_USAGE_REVISION_KEY]: revision + 1,
    };
    if (idemField) nextLimits[idemField] = true;

    await prisma.workspaceLimits.upsert({
      where: { workspaceId: input.workspaceId },
      create: { workspaceId: input.workspaceId, limits: nextLimits },
      update: { limits: nextLimits },
    });

    return { reserved: true, used: nextUsed, limit };
  });
}

export async function releaseArReminderEmailReservation(input: {
  workspaceId: string;
  idempotencyKey?: string | null;
}): Promise<void> {
  const meteringActive = await shouldMeterAppointmentRemindersSms(input.workspaceId);
  if (!meteringActive) return;

  const periodKey = await getArCommercialUsagePeriodKey(input.workspaceId);
  const idemKey = input.idempotencyKey?.trim() || null;
  const idemField = idemKey ? `arEmailReserved:${periodKey}:${idemKey}` : null;

  await withArSmsMeteringLock(input.workspaceId, async () => {
    const prisma = getPrisma();
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    if (!limitsRow) return;
    const limits = asRecord(limitsRow.limits);
    if (String(limits[AR_EMAIL_USAGE_PERIOD_KEY] || "") !== periodKey) return;
    if (idemField && limits[idemField] !== true) return;

    const revision = Number(limits[AR_EMAIL_USAGE_REVISION_KEY] || 0);
    const used = Math.max(0, Number(limits[AR_EMAIL_USAGE_USED] || 0) - 1);
    const nextLimits = { ...limits, [AR_EMAIL_USAGE_USED]: used, [AR_EMAIL_USAGE_REVISION_KEY]: revision + 1 };
    if (idemField) delete nextLimits[idemField];

    await prisma.workspaceLimits.update({
      where: { workspaceId: input.workspaceId },
      data: { limits: nextLimits },
    });
  });
}
