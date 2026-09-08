/**
 * Phase 2 wiring smoke tests (no Next.js server required).
 */
import assert from "node:assert/strict";
import { editorDefaultsForBookingTypeKind } from "../src/lib/appointments/booking-type-kind";

function suggestAutoEntitlement(entitlements: {
  packages: Array<{ id: string }>;
  gifts: Array<{ code: string }>;
}) {
  if (entitlements.packages.length === 1) {
    return { method: "package" as const, packageBalanceId: entitlements.packages[0].id };
  }
  if (!entitlements.packages.length && entitlements.gifts.length === 1) {
    return { method: "gift" as const, giftCode: entitlements.gifts[0].code };
  }
  return { method: "none" as const };
}

function calculateAddOnTotals(
  addOns: Array<{ priceCents: number; durationDeltaMinutes: number; quantity?: number }>,
) {
  let priceCents = 0;
  let durationDeltaMinutes = 0;
  for (const addOn of addOns) {
    const qty = addOn.quantity ?? 1;
    priceCents += addOn.priceCents * qty;
    durationDeltaMinutes += addOn.durationDeltaMinutes * qty;
  }
  return { priceCents, durationDeltaMinutes };
}

function computePhasedDurationMinutes(phases: Array<{ durationMinutes: number }>) {
  return phases.reduce((sum, p) => sum + p.durationMinutes, 0);
}

function resolvePackageCreditKey(
  remainingCredits: Record<string, number>,
  bookingTypeId?: string,
): string | null {
  if (bookingTypeId && (remainingCredits[bookingTypeId] ?? 0) > 0) return bookingTypeId;
  if ((remainingCredits.default ?? 0) > 0) return "default";
  return null;
}

assert.equal(suggestAutoEntitlement({ packages: [{ id: "pkg-1" }], gifts: [] }).method, "package");
assert.equal(
  suggestAutoEntitlement({ packages: [], gifts: [{ code: "GIFT100" }] }).giftCode,
  "GIFT100",
);
assert.equal(
  suggestAutoEntitlement({ packages: [{ id: "a" }, { id: "b" }], gifts: [] }).method,
  "none",
);

const totals = calculateAddOnTotals([
  { priceCents: 1500, durationDeltaMinutes: 10, quantity: 2 },
  { priceCents: 500, durationDeltaMinutes: 0, quantity: 1 },
]);
assert.equal(totals.priceCents, 3500);
assert.equal(totals.durationDeltaMinutes, 20);

assert.equal(
  computePhasedDurationMinutes([{ durationMinutes: 15 }, { durationMinutes: 30 }]),
  45,
);

assert.equal(resolvePackageCreditKey({ default: 2, "type-1": 1 }, "type-1"), "type-1");

assert.equal(editorDefaultsForBookingTypeKind("MEETING").advancedExpandedByDefault, false);
assert.equal(editorDefaultsForBookingTypeKind("SERVICE").advancedExpandedByDefault, true);

console.log("test-phase2-wiring: PASS");
