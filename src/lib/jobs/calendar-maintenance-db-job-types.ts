/** Low-volume calendar safety-net jobs — drained from Postgres, not BullMQ. */
export const CALENDAR_MAINTENANCE_DB_JOB_TYPES = [
  "calendar_connections_reconcile",
  "calendar_subscription_renew",
] as const;

export type CalendarMaintenanceDbJobType = (typeof CALENDAR_MAINTENANCE_DB_JOB_TYPES)[number];

export function isCalendarMaintenanceDbJob(jobType: string): boolean {
  return (CALENDAR_MAINTENANCE_DB_JOB_TYPES as readonly string[]).includes(jobType);
}
