import assert from "node:assert/strict";
import { calendarSyncStuckProcessingMs } from "./microsoft-routine-sync-coalesce";

assert.ok(calendarSyncStuckProcessingMs() >= 60_000);

process.env.CALENDAR_SYNC_STUCK_PROCESSING_MS = "120000";
assert.equal(calendarSyncStuckProcessingMs(), 120_000);

console.log("microsoft-routine-sync-coalesce.test.ts PASS");
