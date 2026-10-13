import assert from "node:assert/strict";
import { routineMicrosoftCalendarSyncIdempotencyKey } from "./microsoft-routine-sync-eligibility";

const connectionId = "conn_test_123";
const keyA = routineMicrosoftCalendarSyncIdempotencyKey(connectionId, true);
const keyB = routineMicrosoftCalendarSyncIdempotencyKey(connectionId, true);
assert.equal(keyA, keyB);
assert.equal(keyA, `calendar-sync-routine-${connectionId}-inc`);
assert.notEqual(
  keyA,
  routineMicrosoftCalendarSyncIdempotencyKey(connectionId, false),
);

console.log("microsoft-routine-sync-coalesce-logic.test.ts PASS");
