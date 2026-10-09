import "server-only";

/** Target backstop interval for Microsoft calendar reconciliation (minutes). */
/**
 * Global reconcile is enqueued once per minute (`calendar-reconcile:${minuteKey}`).
 * Run a single maintenance worker fleet; overlapping schedulers rely on per-connection enqueue leases.
 */
export function microsoftCalendarReconcileIntervalMinutes(): number {
  const raw = process.env.MICROSOFT_CALENDAR_RECONCILE_MINUTES?.trim();
  const parsed = raw ? Number(raw) : 5;
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(Math.floor(parsed), 60);
}

export function microsoftReconcileDiscoveryBudgetPerTick(): number {
  const raw = process.env.MICROSOFT_CALENDAR_RECONCILE_BATCH?.trim();
  const parsed = raw ? Number(raw) : 750;
  if (!Number.isFinite(parsed) || parsed < 50) return 750;
  return Math.min(Math.floor(parsed), 5_000);
}

export function microsoftSubscriptionRenewBatchPerTick(): number {
  const raw = process.env.MICROSOFT_CALENDAR_RENEW_BATCH?.trim();
  const parsed = raw ? Number(raw) : 400;
  if (!Number.isFinite(parsed) || parsed < 50) return 400;
  return Math.min(Math.floor(parsed), 2_000);
}

/** Lease while a sync job is expected to start (prevents duplicate enqueue). */
export function microsoftSyncEnqueueLeaseMs(): number {
  return 120_000;
}

export function microsoftSyncFailureBackoffMs(attempt: number): number {
  const base = 60_000;
  const capped = Math.min(base * 2 ** Math.min(attempt, 6), 30 * 60_000);
  const jitter = Math.floor(Math.random() * 15_000);
  return capped + jitter;
}
