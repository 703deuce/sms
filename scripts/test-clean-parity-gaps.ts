/**
 * Verifies clean Acuity / SimplyBook / Square Appointments parity gap modules.
 * Run: npx tsx scripts/test-clean-parity-gaps.ts
 */
import assert from "node:assert/strict";
import {
  filterSlotsToFixedStartTimes,
  slotStepMinutes,
} from "../src/lib/appointments/service-booking/fixed-start-times";
import { applyAvailabilityDensityHide } from "../src/lib/appointments/service-booking/availability-density";
import {
  buildTermsAcceptanceSnapshot,
  validateTermsAcceptance,
} from "../src/lib/appointments/service-booking/terms-acceptance";
import { formatPublicCapacityLabel } from "../src/lib/appointments/service-booking/class-capacity-display";
import { staffBusyIntervalsFromPhases } from "../src/lib/appointments/service-booking/staff-phase-occupancy";

function testFixedStartTimes() {
  const slots = [
    { startsAt: "2026-09-10T13:00:00.000Z", endsAt: "2026-09-10T13:30:00.000Z" },
    { startsAt: "2026-09-10T14:00:00.000Z", endsAt: "2026-09-10T14:30:00.000Z" },
  ];
  const filtered = filterSlotsToFixedStartTimes(
    slots,
    { enabled: true, times: ["09:00", "10:00"] },
    "America/New_York",
  );
  assert.ok(Array.isArray(filtered));
  assert.equal(slotStepMinutes(30, 15), 15);
  console.log("  fixed-start-times: OK");
}

function testAvailabilityDensity() {
  const slots = Array.from({ length: 20 }, (_, i) => ({
    startsAt: `2026-09-10T${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00.000Z`,
    endsAt: `2026-09-10T${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "59" : "29"}:00.000Z`,
  }));
  const hidden = applyAvailabilityDensityHide(slots, 50, "test");
  assert.ok(hidden.length < slots.length);
  console.log("  availability-density: OK");
}

function testTermsAcceptance() {
  const snap = buildTermsAcceptanceSnapshot({
    termsVersion: "v1",
    termsText: "By booking you agree.",
  });
  assert.equal(snap.accepted, true);
  assert.ok(snap.termsTextHash.length > 10);
  validateTermsAcceptance({ termsAccepted: true, termsVersion: "v1" }, "v1");
  console.log("  terms-acceptance: OK");
}

function testClassCapacityDisplay() {
  assert.equal(formatPublicCapacityLabel(3, 10, "exact"), "3 spots left");
  assert.equal(formatPublicCapacityLabel(0, 10, "limited"), "Full");
  assert.equal(formatPublicCapacityLabel(5, 10, "hidden"), null);
  console.log("  class-capacity-display: OK");
}

function testStaffPhaseOccupancy() {
  const start = new Date("2026-09-10T14:00:00.000Z");
  const busy = staffBusyIntervalsFromPhases(start, [
    { phaseKind: "active_staff", durationMinutes: 30, staffRequired: true },
    { phaseKind: "processing", durationMinutes: 20, staffRequired: false },
    { phaseKind: "active_staff", durationMinutes: 10, staffRequired: true },
  ]);
  assert.equal(busy.length, 2);
  console.log("  staff-phase-occupancy: OK");
}

async function main() {
  console.log("Clean parity gap module tests\n");
  testFixedStartTimes();
  testAvailabilityDensity();
  testTermsAcceptance();
  testClassCapacityDisplay();
  testStaffPhaseOccupancy();
  console.log("\nAll clean parity gap tests PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
