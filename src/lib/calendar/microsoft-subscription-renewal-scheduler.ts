import "server-only";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";
import { microsoftSubscriptionRenewBatchPerTick } from "@/lib/calendar/microsoft-schedule-config";
import { getPrisma } from "@/lib/db";

const RENEW_AHEAD_MS = 6 * 3600_000;

/** Earliest Graph subscription expiry across per-calendar subs (falls back to legacy single sub). */
export function microsoftSubscriptionExpiryMs(config: CalendarConfig): number | null {
  const subs = config.microsoftCalendarSubscriptions || [];
  if (subs.length) {
    const times = subs
      .map((s) => (s.expiresAt ? new Date(s.expiresAt).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));
    if (times.length) return Math.min(...times);
  }
  const legacy = config.microsoftSubscription?.expiresAt;
  return legacy ? new Date(legacy).getTime() : null;
}

function defaultRenewDueFromConfig(config: CalendarConfig): Date | null {
  const expiryMs = microsoftSubscriptionExpiryMs(config);
  if (expiryMs == null) return new Date();
  return new Date(expiryMs - RENEW_AHEAD_MS);
}

/**
 * Renew Microsoft Graph subscriptions in expiration order with bounded batches.
 */
export async function renewDueMicrosoftCalendarSubscriptions(input?: {
  budget?: number;
}): Promise<{ scanned: number; renewed: number; errors: number }> {
  const prisma = getPrisma();
  const budget = input?.budget ?? microsoftSubscriptionRenewBatchPerTick();
  const now = new Date();
  let renewed = 0;
  let errors = 0;
  let scanned = 0;

  let cursorDue: Date | null = null;
  let cursorId: string | null = null;

  while (scanned < budget) {
    const take = Math.min(50, budget - scanned);
    const batch = await prisma.voiceCalendarConnection.findMany({
      where: {
        provider: "microsoft",
        status: "connected",
        OR: [{ subscriptionRenewDueAt: null }, { subscriptionRenewDueAt: { lte: now } }],
        ...(cursorDue && cursorId
          ? {
              OR: [
                { subscriptionRenewDueAt: { gt: cursorDue } },
                { subscriptionRenewDueAt: cursorDue, id: { gt: cursorId } },
                { subscriptionRenewDueAt: null, id: { gt: cursorId } },
              ],
            }
          : {}),
      },
      orderBy: [{ subscriptionRenewDueAt: "asc" }, { id: "asc" }],
      take,
      select: { id: true, workspaceId: true, config: true, subscriptionRenewDueAt: true },
    });

    if (!batch.length) break;

    for (const conn of batch) {
      scanned += 1;
      const config = (conn.config || {}) as CalendarConfig;
      if (!shouldImportFromConnection(config)) {
        await prisma.voiceCalendarConnection.update({
          where: { id: conn.id },
          data: { subscriptionRenewDueAt: new Date(now.getTime() + 24 * 3600_000) },
        });
        continue;
      }

      const expiryMs = microsoftSubscriptionExpiryMs(config);
      const needsRenew =
        expiryMs == null || expiryMs < now.getTime() + RENEW_AHEAD_MS;

      if (!needsRenew && conn.subscriptionRenewDueAt && conn.subscriptionRenewDueAt > now) {
        continue;
      }

      try {
        const sub = await ensureMicrosoftCalendarSubscription(conn.workspaceId, conn.id);
        const nextDue =
          sub?.expiresAt
            ? new Date(new Date(sub.expiresAt).getTime() - RENEW_AHEAD_MS)
            : defaultRenewDueFromConfig(config) ?? new Date(now.getTime() + 12 * 3600_000);
        await prisma.voiceCalendarConnection.update({
          where: { id: conn.id },
          data: { subscriptionRenewDueAt: nextDue },
        });
        renewed += 1;
      } catch (err) {
        errors += 1;
        console.warn("[calendar] microsoft subscription renew scheduler failed", conn.id, err);
        await prisma.voiceCalendarConnection.update({
          where: { id: conn.id },
          data: { subscriptionRenewDueAt: new Date(now.getTime() + 30 * 60_000) },
        });
      }
    }

    const last = batch[batch.length - 1];
    cursorDue = last.subscriptionRenewDueAt ?? new Date(0);
    cursorId = last.id;
    if (batch.length < take) break;
  }

  return { scanned, renewed, errors };
}
