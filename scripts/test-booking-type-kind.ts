/**
 * Unit checks for booking type archetypes (Phase 1 — gap closure).
 * Run: npx tsx scripts/test-booking-type-kind.ts
 */
import assert from "node:assert/strict";
import {
  BOOKING_TYPE_KINDS,
  editorDefaultsForBookingTypeKind,
  featuresForBookingTypeKind,
  resolveBookingTypeKind,
} from "../src/lib/appointments/booking-type-kind";

assert.deepEqual(BOOKING_TYPE_KINDS, ["MEETING", "SERVICE", "CLASS"]);

assert.equal(resolveBookingTypeKind({}), "SERVICE");
assert.equal(resolveBookingTypeKind({ bookingTypeKind: "MEETING" }), "MEETING");
assert.equal(resolveBookingTypeKind({ bookingTypeKind: "CLASS" }), "CLASS");

const meetingDefaults = editorDefaultsForBookingTypeKind("MEETING");
assert.equal(meetingDefaults.advancedExpandedByDefault, false);
assert.equal(meetingDefaults.suggestPayment, false);

const serviceDefaults = editorDefaultsForBookingTypeKind("SERVICE");
assert.equal(serviceDefaults.suggestPayment, true);

const klassDefaults = editorDefaultsForBookingTypeKind("CLASS");
assert.equal(klassDefaults.suggestGroupCapacity, true);

// All capabilities remain available (not hard-disabled)
const meetingFeatures = featuresForBookingTypeKind("MEETING");
assert.equal(meetingFeatures.showPayment, true);
assert.equal(meetingFeatures.showResources, true);
assert.equal(meetingFeatures.showAddOns, true);

const classFeatures = featuresForBookingTypeKind("CLASS");
assert.equal(classFeatures.showResources, true);
assert.equal(classFeatures.showAddOns, true);
assert.equal(classFeatures.showClassEnrollment, true);

console.log("test-booking-type-kind: PASS");
