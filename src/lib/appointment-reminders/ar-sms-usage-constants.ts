/**
 * Appointment Reminders SMS allowance — limits come from configuration, not hardcoded product prices.
 *
 * Sources (priority):
 * 1. workspace_limits.limits.arAppointmentRemindersMonthlySmsLimit (override)
 * 2. Active platform_product_subscriptions product_family `appointment_reminders` tier map (when catalog ships)
 * 3. Workspace billingPlan → platform settings plan.messages (legacy shared plans)
 * 4. Platform trial.messages (freemium / trial workspaces)
 */

export const AR_PLATFORM_PRODUCT_FAMILY = "appointment_reminders";

export const USAGE_PERIOD_KEY = "arReminderSmsPeriodKey";
export const USAGE_USED = "arReminderSmsUsed";
/** Optimistic concurrency token inside workspace_limits.limits JSON (Supabase-safe). */
export const USAGE_REVISION_KEY = "arReminderSmsUsageRevision";
export const LIMITS_OVERRIDE_KEY = "arAppointmentRemindersMonthlySmsLimit";

/** Metadata on appointment: `${periodKey}:${timelineType}` */
export const EVENT_META_AR_SMS_RESERVED = "arReminderSmsReservedPeriod";

/**
 * Paid tier SMS limits when `appointment_reminders` Stripe family is active.
 * Populate from platform billing catalog when SKUs exist — empty until configured.
 */
export const AR_PAID_SMS_LIMIT_BY_TIER: Record<string, number> = {};

export function currentArSmsUsagePeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function arSmsUsagePeriodUtcBounds(periodKey: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!match) {
    const now = new Date();
    return arSmsUsagePeriodUtcBounds(currentArSmsUsagePeriodKey(now));
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { start, end };
}
