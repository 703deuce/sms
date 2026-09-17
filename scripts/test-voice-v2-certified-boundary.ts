#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSelectedSlotIdFromOffer } from "../src/lib/voice-v2/resolve-slot-from-offer";
import { certifiedBookingHandoffPayload } from "../src/lib/voice-v2/certified-booking-pipeline";

const findRoute = readFileSync(
  "src/app/api/telnyx/voice-v2/find-availability/route.ts",
  "utf8",
);
const bookRoute = readFileSync(
  "src/app/api/telnyx/voice-v2/book-offered-slot/route.ts",
  "utf8",
);
assert.ok(
  findRoute.includes("executeMicrosoft365CertifiedFindAvailability"),
  "find route must use microsoft-365-certified pipeline only",
);
assert.ok(
  bookRoute.includes("executeMicrosoft365CertifiedBookOfferedSlot"),
  "book route must use microsoft-365-certified pipeline only",
);
assert.ok(!/await\s+prisma\.auditLog/.test(findRoute), "find route must void-defer audit");
assert.ok(!/await\s+prisma\.auditLog/.test(bookRoute), "book route must void-defer audit");

const handoff = certifiedBookingHandoffPayload({
  offerSetId: "v2offer_test",
  slots: [{ slot_id: "slot_a", label: "10:00 AM", spoken_label: "10:00 AM" }],
});
assert.equal(handoff.required_next_tool, "voice_v2_book_offered_slot");
assert.ok(
  (handoff.forbidden_actions as string[]).includes("claim_booked_without_book_tool"),
);

const slots = [
  {
    slot_id: "slot_10",
    label: "10:00 AM",
    spoken_label: "10:00 AM",
    start_utc: "2026-09-22T17:00:00.000Z",
    end_utc: "2026-09-22T18:00:00.000Z",
  },
];
assert.equal(resolveSelectedSlotIdFromOffer(slots, "10 o'clock"), "slot_10");
assert.equal(resolveSelectedSlotIdFromOffer(slots, "10:00 AM"), "slot_10");

console.log("test-voice-v2-certified-boundary: ok");
