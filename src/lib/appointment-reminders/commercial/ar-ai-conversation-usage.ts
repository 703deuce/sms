import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveArMonthlyAiConversationLimit } from "@/lib/appointment-reminders/ar-commercial-entitlements";
import { getArCommercialUsagePeriodKey } from "@/lib/appointment-reminders/commercial/ar-usage-keys";
import { withArSmsMeteringLock } from "@/lib/appointment-reminders/ar-sms-usage-metering-lock";
import { shouldMeterAppointmentRemindersSms } from "@/lib/appointment-reminders/ar-sms-usage";

export const AR_AI_USAGE_PERIOD_KEY = "arAiConversationPeriodKey";
export const AR_AI_USAGE_USED = "arAiConversationsUsed";
export const AR_AI_CONVERSATION_KEYS = "arAiConversationKeys";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readAiUsed(limits: Record<string, unknown>, periodKey: string): number {
  const stored = String(limits[AR_AI_USAGE_PERIOD_KEY] || "");
  let used = Number(limits[AR_AI_USAGE_USED] || 0);
  if (stored !== periodKey) used = 0;
  return used;
}

function conversationKeysForPeriod(limits: Record<string, unknown>, periodKey: string): Record<string, boolean> {
  const stored = String(limits[AR_AI_USAGE_PERIOD_KEY] || "");
  if (stored !== periodKey) return {};
  return asRecord(limits[AR_AI_CONVERSATION_KEYS]);
}

export type ArAiConversationUsageSnapshot = {
  periodKey: string;
  usedInPeriod: number;
  limit: number;
  atLimit: boolean;
  meteringActive: boolean;
};

export async function getArAiConversationUsageSnapshot(
  workspaceId: string,
): Promise<ArAiConversationUsageSnapshot> {
  const meteringActive = await shouldMeterAppointmentRemindersSms(workspaceId);
  const periodKey = await getArCommercialUsagePeriodKey(workspaceId);
  const limit = await resolveArMonthlyAiConversationLimit(workspaceId);

  if (!meteringActive || limit <= 0) {
    return { periodKey, usedInPeriod: 0, limit, atLimit: limit === 0, meteringActive: false };
  }

  const row = await getPrisma().workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const used = readAiUsed(limits, periodKey);
  return {
    periodKey,
    usedInPeriod: used,
    limit,
    atLimit: used >= limit,
    meteringActive: true,
  };
}

export type ArAiConversationReserveResult = {
  reserved: boolean;
  used: number;
  limit: number;
  reason?: "ar_ai_limit_reached" | "idempotent_replay" | "metering_inactive" | "not_metered";
};

/**
 * One billable AI conversation per reply session per usage period.
 */
export async function reserveArAiConversation(input: {
  workspaceId: string;
  replySessionId: string;
}): Promise<ArAiConversationReserveResult> {
  const meteringActive = await shouldMeterAppointmentRemindersSms(input.workspaceId);
  const periodKey = await getArCommercialUsagePeriodKey(input.workspaceId);
  const limit = await resolveArMonthlyAiConversationLimit(input.workspaceId);

  if (!meteringActive) {
    return { reserved: true, used: 0, limit, reason: "not_metered" };
  }
  if (limit <= 0) {
    const snap = await getArAiConversationUsageSnapshot(input.workspaceId);
    return { reserved: false, used: snap.usedInPeriod, limit: 0, reason: "ar_ai_limit_reached" };
  }

  const sessionKey = input.replySessionId.trim();
  if (!sessionKey) {
    return { reserved: false, used: 0, limit, reason: "ar_ai_limit_reached" };
  }

  return withArSmsMeteringLock(input.workspaceId, async () => {
    const prisma = getPrisma();
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    const limits = asRecord(limitsRow?.limits);
    const keys = conversationKeysForPeriod(limits, periodKey);
    if (keys[sessionKey]) {
      const used = readAiUsed(limits, periodKey);
      return { reserved: true, used, limit, reason: "idempotent_replay" };
    }

    let used = readAiUsed(limits, periodKey);
    if (used + 1 > limit) {
      return { reserved: false, used, limit, reason: "ar_ai_limit_reached" };
    }

    const nextUsed = used + 1;
    const nextLimits = {
      ...limits,
      [AR_AI_USAGE_PERIOD_KEY]: periodKey,
      [AR_AI_USAGE_USED]: nextUsed,
      [AR_AI_CONVERSATION_KEYS]: { ...keys, [sessionKey]: true },
    };

    await prisma.workspaceLimits.upsert({
      where: { workspaceId: input.workspaceId },
      create: { workspaceId: input.workspaceId, limits: nextLimits },
      update: { limits: nextLimits },
    });

    return { reserved: true, used: nextUsed, limit };
  });
}
