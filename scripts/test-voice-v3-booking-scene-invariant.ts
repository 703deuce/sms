/**
 * Static invariant: Voice V3 booking scene modules exist and expose required log markers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const bookDispatch = readFileSync(
  join(root, "src/lib/voice-v3/calendar/book-dispatch.ts"),
  "utf8",
);

const requiredLogs = [
  "BOOKING_READY",
  "BOOKING_ATTEMPT_CREATED",
  "BOOKING_REVALIDATION_STARTED",
  "BOOKING_REVALIDATION_PASSED",
  "BOOKING_REVALIDATION_FAILED",
  "BOOKING_ATTEMPT_STALE",
  "BOOKING_COMMIT_STARTED",
  "BOOKING_COMMIT_SENT",
  "BOOKING_CONFIRMED",
  "BOOKING_FAILED",
  "BOOKING_OUTCOME_UNKNOWN",
  "LIVE_BOOKING_CONFIRMATION_SENT",
];

for (const marker of requiredLogs) {
  assert.ok(bookDispatch.includes(marker), `book-dispatch must log ${marker}`);
}

assert.ok(
  bookDispatch.includes("revalidateSelectedSlot") ||
    bookDispatch.includes("revalidate"),
  "book-dispatch must revalidate before commit",
);

const rules = readFileSync(join(root, "src/lib/voice-v3/state/call-rules.ts"), "utf8");
assert.ok(rules.includes("bookingReady"), "call-rules must expose bookingReady");

const createBooking = readFileSync(
  join(root, "src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts"),
  "utf8",
);
assert.ok(createBooking.length > 100, "microsoft-create-booking executor must exist");

console.log("PASS voice-v3 booking scene invariant");
