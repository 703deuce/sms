/**
 * npx tsx scripts/test-calendar-reschedule-validation.ts
 */
import assert from "node:assert/strict";
import { SchedulingConflictError } from "../src/lib/appointments/scheduling-conflict-error";
import { SlotTakenError } from "../src/lib/appointments/slot-errors";
import { sanitizeReturnTo } from "../src/lib/navigation/return-context";

const err = new SchedulingConflictError("NOT_IN_AVAILABILITY", "Grid mismatch");
assert.equal(err.code, "NOT_IN_AVAILABILITY");
assert.match(err.message, /Grid mismatch/);

const taken = new SlotTakenError("Room 2 is reserved.");
assert.equal(taken.code, "SLOT_TAKEN");

assert.equal(sanitizeReturnTo("/appointments/calendar?view=week"), "/appointments/calendar?view=week");
assert.equal(sanitizeReturnTo("https://evil.com"), null);
assert.equal(sanitizeReturnTo("/admin/secret"), null);

console.log("test-calendar-reschedule-validation: OK");
