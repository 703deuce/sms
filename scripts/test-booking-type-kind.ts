/**
 * Unit checks for booking type archetypes (Phase 1 — gap closure).
 * Run: npx tsx scripts/test-booking-type-kind.ts
 */
import assert from "node:assert/strict";
import {
  BOOKING_TYPE_KINDS,
  featuresForBookingTypeKind,
  resolveBookingTypeKind,
} from "../src/lib/appointments/booking-type-kind";

assert.deepEqual(BOOKING_TYPE_KINDS, ["MEETING", "SERVICE", "CLASS"]);

assert.equal(resolveBookingTypeKind({}), "SERVICE");
assert.equal(resolveBookingTypeKind({ bookingTypeKind: "MEETING" }), "MEETING");
assert.equal(resolveBookingTypeKind({ bookingTypeKind: "CLASS" }), "CLASS");
assert.equal(resolveBookingTypeKind({ bookingTypeKind: "invalid" as "MEETING" }), "SERVICE");

const meeting = featuresForBookingTypeKind("MEETING");
assert.equal(meeting.showPayment, false);
assert.equal(meeting.showRecurring, false);
assert.equal(meeting.showClassEnrollment, false);

const service = featuresForBookingTypeKind("SERVICE");
assert.equal(service.showPayment, true);
assert.equal(service.showResources, true);
assert.equal(service.showAddOns, true);

const klass = featuresForBookingTypeKind("CLASS");
assert.equal(klass.showClassEnrollment, true);
assert.equal(klass.showGroupCapacity, true);
assert.equal(klass.showResources, false);

console.log("test-booking-type-kind: PASS");
