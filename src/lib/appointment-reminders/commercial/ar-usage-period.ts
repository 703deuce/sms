import "server-only";

import type { ArPlanKey } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";

export type ArUsagePeriod = {
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  source: "stripe_subscription" | "free_entitlement" | "legacy_grandfather";
};

/** Stripe-aligned or free rolling month — stored as ISO bounds in workspace limits when free. */
export function buildArUsagePeriodKey(start: Date, end: Date): string {
  return `${start.toISOString()}__${end.toISOString()}`;
}

export function parseArUsagePeriodKey(key: string): { start: Date; end: Date } | null {
  const parts = key.split("__");
  if (parts.length !== 2) return null;
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function rollingFreeMonthPeriod(anchor: Date, now = new Date()): ArUsagePeriod {
  const start = new Date(anchor);
  while (start <= now) {
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    if (now < end) {
      return {
        periodKey: buildArUsagePeriodKey(start, end),
        periodStart: start,
        periodEnd: end,
        source: "free_entitlement",
      };
    }
    start.setUTCMonth(start.getUTCMonth() + 1);
  }
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    periodKey: buildArUsagePeriodKey(start, end),
    periodStart: start,
    periodEnd: end,
    source: "free_entitlement",
  };
}

export function stripeSubscriptionPeriod(
  periodStart: Date | null | undefined,
  periodEnd: Date | null | undefined,
): ArUsagePeriod | null {
  if (!periodStart || !periodEnd) return null;
  return {
    periodKey: buildArUsagePeriodKey(periodStart, periodEnd),
    periodStart,
    periodEnd,
    source: "stripe_subscription",
  };
}

export function legacyGrandfatherPeriod(now = new Date()): ArUsagePeriod {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    periodKey: buildArUsagePeriodKey(start, end),
    periodStart: start,
    periodEnd: end,
    source: "legacy_grandfather",
  };
}

export type ArWorkspaceCommercialSnapshot = {
  planKey: ArPlanKey;
  hasProductAccess: boolean;
  usagePeriod: ArUsagePeriod;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  cancelAtPeriodEnd: boolean;
  paidThrough: Date | null;
  isLegacyGrandfather: boolean;
};
