#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { mapSpecialistToOrchestratorInput } from "../src/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { resolveOfferedSlotIdFromSpecialist } from "../src/lib/mctb/ai-booking/resolve-offered-slot-from-specialist";
import { pickSlotsToOffer } from "../src/lib/mctb/ai-booking/slot-presentation";
import { isProviderSlotConflictReason } from "../src/lib/mctb/ai-booking/offered-slot-selection";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

function slot(start: string, id?: string): MctbBookingSlot {
  return {
    slotId: id || `id:${start}`,
    startUtc: start,
    endUtc: start,
    timezone: "America/New_York",
  };
}

const offer = pickSlotsToOffer(
  [
    slot("2026-09-15T13:00:00.000Z", "nine"),
    slot("2026-09-15T14:00:00.000Z", "ten"),
    slot("2026-09-15T15:00:00.000Z", "eleven"),
  ],
  3,
);

assert.equal(
  resolveOfferedSlotIdFromSpecialist(
    { action: "SELECT_OFFERED_SLOT", timezone: "America/New_York", offered_slot_index: 2 },
    offer,
    "America/New_York",
  ),
  "ten",
);

assert.equal(
  resolveOfferedSlotIdFromSpecialist(
    { action: "SELECT_OFFERED_SLOT", timezone: "America/New_York", offered_slot_id: "bogus" },
    offer,
    "America/New_York",
  ),
  null,
);

const mapped = mapSpecialistToOrchestratorInput(
  {
    action: "CONFIRM_BOOKING",
    timezone: "America/New_York",
    offered_slot_index: 3,
    customer_confirms_booking: true,
  },
  {
    workspaceId: "ws",
    conversationId: "c",
    customerName: "Guest",
    customerPhone: "+1",
    timezone: "America/New_York",
    customerMessage: "the third one works",
  },
  { sessionHasOfferedSlots: true, offeredSlots: offer },
);
assert.equal(mapped?.selectedSlotId, "eleven");
assert.equal(mapped?.confirmBooking, true);

assert.equal(isProviderSlotConflictReason("Calendar conflict at that time"), true);
assert.equal(isProviderSlotConflictReason("network error"), false);

console.log("test-mctb-ai-booking-slot-session: OK");
