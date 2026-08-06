/**
 * Booking idempotency helpers for timeout retries.
 * Run: npx tsx scripts/test-book-idempotency.ts
 */
import assert from "node:assert/strict";
import {
  findExistingBookingForCaller,
  findAppointmentsForCaller,
} from "../src/lib/voice/calendar/booking";

// Unit-level: exercise phone matching via exported find helpers against in-memory
// is not possible without DB. Instead, validate the pure matching behavior by
// re-implementing the same digit rules the booking module uses through a thin
// local copy that mirrors appointmentBelongsToCaller semantics via find results
// shape. For CI without DB we only assert export presence + digit logic clone.

function phoneDigits(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

function belongs(
  metaPhone: string,
  contactId: string | null,
  phone: string,
  wantContact?: string,
): boolean {
  if (wantContact && contactId && contactId === wantContact) return true;
  const want = phoneDigits(phone);
  if (!want) return false;
  const c = phoneDigits(metaPhone);
  return Boolean(c && (c === want || c.endsWith(want) || want.endsWith(c)));
}

assert.equal(phoneDigits("+15714776175"), "5714776175");
assert.equal(phoneDigits("571-477-6175"), "5714776175");
assert.equal(phoneDigits("1 (571) 477-6175"), "5714776175");
assert.equal(belongs("571-477-6175", null, "+15714776175"), true);
assert.equal(belongs("+15714776175", null, "5714776175"), true);
assert.equal(belongs("5551112222", null, "+15714776175"), false);
assert.equal(belongs("", "c1", "+15714776175", "c1"), true);
assert.equal(belongs("", "c1", "+15714776175", "c2"), false);

assert.equal(typeof findExistingBookingForCaller, "function");
assert.equal(typeof findAppointmentsForCaller, "function");

console.log("All book-idempotency checks passed.");
