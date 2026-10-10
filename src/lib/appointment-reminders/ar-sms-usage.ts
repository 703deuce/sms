import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { resolveArMonthlySmsLimit } from "@/lib/appointment-reminders/ar-commercial-entitlements";
import { getArCommercialUsagePeriodKey } from "@/lib/appointment-reminders/commercial/ar-usage-keys";
import { usesPlatformAppointmentSmsSender } from "@/lib/appointment-reminders/platform-template-policy";
import {
  arSmsUsagePeriodUtcBounds,
  currentArSmsUsagePeriodKey,
  EVENT_META_AR_SMS_RESERVED,
  USAGE_PERIOD_KEY,
  USAGE_USED,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { readArSmsUsedFromLimits } from "@/lib/appointment-reminders/ar-sms-usage-limit-math";
import { withArSmsMeteringLock } from "@/lib/appointment-reminders/ar-sms-usage-metering-lock";
import { USAGE_REVISION_KEY } from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { isSmsReminderTimelineEvent } from "@/lib/appointment-reminders/sms-reminder-timeline";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isBillableSentTimelineType(type: string): boolean {
  const t = String(type || "").toLowerCase();
  if (!isSmsReminderTimelineEvent(t)) return false;
  if (t.includes("failed") || t.includes("skipped")) return false;
  return t.endsWith("_sent") || t === "confirmation_sent";
}

function reservationMetaKey(periodKey: string, timelineType: string): string {
  return `${periodKey}:${timelineType}`;
}

export type ArSmsUsageSnapshot = {
  periodKey: string;
  usedInPeriod: number;
  limit: number;
  atLimit: boolean;
  limitSource: string;
  meteringActive: boolean;
};

async function workspaceLimitsRecord(workspaceId: string): Promise<Record<string, unknown>> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  return asRecord(row?.limits);
}

/** Test workspaces may set `limits.arSmsMeteringEnabled` to exercise billing without platform sender. */
export async function shouldMeterAppointmentRemindersSms(
  workspaceId: string,
): Promise<boolean> {
  const limits = await workspaceLimitsRecord(workspaceId);
  if (limits.arSmsMeteringEnabled === true) return true;
  return usesPlatformAppointmentSmsSender(workspaceId);
}

export async function getArSmsUsageSnapshot(workspaceId: string): Promise<ArSmsUsageSnapshot> {
  const [meteringActive, limitResolution] = await Promise.all([
    shouldMeterAppointmentRemindersSms(workspaceId),
    resolveArMonthlySmsLimit(workspaceId),
  ]);

  const periodKey = await getArCommercialUsagePeriodKey(workspaceId);
  const limit = limitResolution.limit;

  if (!meteringActive) {
    return {
      periodKey,
      usedInPeriod: 0,
      limit,
      atLimit: false,
      limitSource: limitResolution.source,
      meteringActive: false,
    };
  }

  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const storedPeriod = String(limits[USAGE_PERIOD_KEY] || "");
  let used = Number(limits[USAGE_USED] || 0);
  if (storedPeriod !== periodKey) used = 0;

  const counted = await countBillableArReminderSmsSentInPeriod(workspaceId, periodKey);
  if (counted > used) {
    used = counted;
    await persistWorkspaceArSmsUsed(workspaceId, periodKey, used, limits);
  }

  return {
    periodKey,
    usedInPeriod: used,
    limit,
    atLimit: limit > 0 && used >= limit,
    limitSource: limitResolution.source,
    meteringActive: true,
  };
}

async function countBillableArReminderSmsSentInPeriod(
  workspaceId: string,
  periodKey: string,
): Promise<number> {
  const { start, end } = arSmsUsagePeriodUtcBounds(periodKey);
  const prisma = getPrisma();
  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId },
    select: { metadata: true },
  });

  let count = 0;
  for (const row of appointments) {
    const meta = asRecord(row.metadata);
    if (meta.testSms === true || meta.excludeFromArSmsUsage === true) continue;
    const timeline = Array.isArray(meta.timeline) ? meta.timeline : [];
    for (const ev of timeline) {
      const item = asRecord(ev);
      const eventType = String(item.type || "");
      if (!isBillableSentTimelineType(eventType)) continue;
      const atRaw = item.at;
      if (!atRaw) continue;
      const at = new Date(String(atRaw));
      if (Number.isNaN(at.getTime()) || at < start || at >= end) continue;
      count += 1;
    }
  }
  return count;
}

async function persistWorkspaceArSmsUsed(
  workspaceId: string,
  periodKey: string,
  used: number,
  existingLimits?: Record<string, unknown>,
): Promise<void> {
  const prisma = getPrisma();
  const limits =
    existingLimits ??
    asRecord(
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

export type ArSmsReservationResult = {
  reserved: boolean;
  used: number;
  limit: number;
  reason?:
    | "ar_sms_limit_reached"
    | "test_excluded"
    | "idempotent_replay"
    | "metering_inactive"
    | "unconfigured_limit";
};

async function appointmentAlreadyReserved(
  tx: Pick<Prisma.TransactionClient, "voiceAppointment">,
  appointmentId: string,
  periodKey: string,
  timelineType: string,
): Promise<boolean> {
  const row = await tx.voiceAppointment.findUnique({
    where: { id: appointmentId },
    select: { metadata: true },
  });
  if (!row) return false;
  const meta = asRecord(row.metadata);
  const key = reservationMetaKey(periodKey, timelineType);
  const reserved = asRecord(meta.arSmsReservations);
  return reserved[key] === true || meta[EVENT_META_AR_SMS_RESERVED] === key;
}

async function markAppointmentArSmsReserved(
  tx: Pick<Prisma.TransactionClient, "voiceAppointment">,
  appointmentId: string,
  periodKey: string,
  timelineType: string,
): Promise<void> {
  const row = await tx.voiceAppointment.findUnique({
    where: { id: appointmentId },
    select: { metadata: true },
  });
  if (!row) return;
  const meta = asRecord(row.metadata);
  const key = reservationMetaKey(periodKey, timelineType);
  const reserved = asRecord(meta.arSmsReservations);
  await tx.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        arSmsReservations: { ...reserved, [key]: true },
      },
    },
  });
}

/**
 * Reserve one AR reminder SMS before provider send (platform-sender metering only).
 */
export async function reserveArReminderSmsUnit(input: {
  workspaceId: string;
  appointmentId?: string | null;
  timelineType?: string | null;
  excludeFromUsage?: boolean;
  /** Billable SMS segments for this outbound message (GSM-7 / Unicode). */
  segments?: number;
}): Promise<ArSmsReservationResult> {
  const metering = await shouldMeterAppointmentRemindersSms(input.workspaceId);
  if (!metering) {
    const snap = await getArSmsUsageSnapshot(input.workspaceId);
    return {
      reserved: true,
      used: snap.usedInPeriod,
      limit: snap.limit,
      reason: "metering_inactive",
    };
  }

  if (input.excludeFromUsage) {
    const snap = await getArSmsUsageSnapshot(input.workspaceId);
    return {
      reserved: true,
      used: snap.usedInPeriod,
      limit: snap.limit,
      reason: "test_excluded",
    };
  }

  const { limit } = await resolveArMonthlySmsLimit(input.workspaceId);
  if (limit <= 0) {
    return { reserved: false, used: 0, limit: 0, reason: "unconfigured_limit" };
  }

  const periodKey = await getArCommercialUsagePeriodKey(input.workspaceId);
  const appointmentId = input.appointmentId?.trim() || null;
  const timelineType = input.timelineType?.trim() || "reminder";
  const segments = Math.max(1, Math.min(10, Math.floor(input.segments ?? 1)));

  return withArSmsMeteringLock(input.workspaceId, async () => {
    const prisma = getPrisma();

    if (
      appointmentId &&
      timelineType &&
      (await appointmentAlreadyReserved(prisma, appointmentId, periodKey, timelineType))
    ) {
      const limitsRow = await prisma.workspaceLimits.findUnique({
        where: { workspaceId: input.workspaceId },
        select: { limits: true },
      });
      const used = readArSmsUsedFromLimits(limitsRow?.limits, periodKey);
      return {
        reserved: true,
        used,
        limit,
        reason: "idempotent_replay",
      };
    }

    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    const limits = asRecord(limitsRow?.limits);
    let used = readArSmsUsedFromLimits(limits, periodKey);

    const counted = await countBillableArReminderSmsSentInPeriod(input.workspaceId, periodKey);
    if (counted > used) used = counted;

    if (used + segments > limit) {
      return { reserved: false, used, limit, reason: "ar_sms_limit_reached" };
    }

    const nextUsed = used + segments;
    const revision = Number(limits[USAGE_REVISION_KEY] || 0);
    const nextLimits = {
      ...limits,
      [USAGE_PERIOD_KEY]: periodKey,
      [USAGE_USED]: nextUsed,
      [USAGE_REVISION_KEY]: revision + 1,
    };

    await prisma.workspaceLimits.upsert({
      where: { workspaceId: input.workspaceId },
      create: { workspaceId: input.workspaceId, limits: nextLimits },
      update: { limits: nextLimits },
    });

    if (appointmentId && timelineType) {
      await markAppointmentArSmsReserved(prisma, appointmentId, periodKey, timelineType);
    }

    return { reserved: true, used: nextUsed, limit };
  });
}

export async function releaseArReminderSmsReservation(input: {
  workspaceId: string;
  appointmentId?: string | null;
  timelineType?: string | null;
  segments?: number;
}): Promise<void> {
  const metering = await shouldMeterAppointmentRemindersSms(input.workspaceId);
  if (!metering) return;

  const periodKey = await getArCommercialUsagePeriodKey(input.workspaceId);
  const segments = Math.max(1, Math.min(10, Math.floor(input.segments ?? 1)));
  const appointmentId = input.appointmentId?.trim() || null;
  const timelineType = input.timelineType?.trim() || "reminder";

  await withArSmsMeteringLock(input.workspaceId, async () => {
    const prisma = getPrisma();

    if (appointmentId) {
      const row = await prisma.voiceAppointment.findUnique({
        where: { id: appointmentId },
        select: { metadata: true },
      });
      const meta = asRecord(row?.metadata);
      const key = reservationMetaKey(periodKey, timelineType);
      const reserved = asRecord(meta.arSmsReservations);
      if (!reserved[key]) return;
      const restReserved = { ...reserved };
      delete restReserved[key];
      await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: { metadata: { ...meta, arSmsReservations: restReserved } },
      });
    }

    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    if (!limitsRow) return;
    const limits = asRecord(limitsRow.limits);
    if (String(limits[USAGE_PERIOD_KEY] || "") !== periodKey) return;
    const revision = Number(limits[USAGE_REVISION_KEY] || 0);
    const used = Math.max(0, Number(limits[USAGE_USED] || 0) - segments);
    await prisma.workspaceLimits.update({
      where: { workspaceId: input.workspaceId },
      data: {
        limits: {
          ...limits,
          [USAGE_USED]: used,
          [USAGE_REVISION_KEY]: revision + 1,
        },
      },
    });
  });
}
