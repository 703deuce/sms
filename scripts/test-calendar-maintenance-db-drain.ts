import assert from "node:assert/strict";
import {
  CALENDAR_MAINTENANCE_DB_JOB_TYPES,
  isCalendarMaintenanceDbJob,
} from "../src/lib/jobs/calendar-maintenance-db-job-types";

assert.ok(isCalendarMaintenanceDbJob("calendar_connections_reconcile"));
assert.ok(isCalendarMaintenanceDbJob("calendar_subscription_renew"));
assert.equal(isCalendarMaintenanceDbJob("crm_scheduled_incremental"), false);
assert.equal(CALENDAR_MAINTENANCE_DB_JOB_TYPES.length, 2);

console.log("PASS test-calendar-maintenance-db-drain");
