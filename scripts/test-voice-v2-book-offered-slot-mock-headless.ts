#!/usr/bin/env npx tsx
/**
 * Deterministic BOOK regression (no live Microsoft).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-book-offered-slot-mock-headless.ts
 */
import assert from "node:assert/strict";
import { executeVoiceV2BookOfferedSlot } from "../src/lib/voice-receptionist-wizard/book-offered-slot";
import { persistVoiceV2OfferSet } from "../src/lib/voice-receptionist-wizard/offer-set-store";

const WORKSPACE_ID = "ws_test";

async function main() {
  const offer = await persistVoiceV2OfferSet({
    workspaceId: WORKSPACE_ID,
    voiceCallId: null,
    serviceName: "Consultation",
    timezone: "America/New_York",
    connectionId: "conn_mock",
    slots: [
      {
        slot_id: "slot_mock_1",
        label: "1:00 PM",
        spoken_label: "1:00 PM",
        start_utc: new Date(Date.now() + 86400000).toISOString(),
        end_utc: new Date(Date.now() + 86400000 + 1800000).toISOString(),
      },
    ],
  });

  const invalid = await executeVoiceV2BookOfferedSlot(
    { offer_set_id: "missing", selected_slot_id: "slot_mock_1" },
    WORKSPACE_ID,
  );
  assert.equal(invalid.status, "INVALID_OFFER");

  const badSlot = await executeVoiceV2BookOfferedSlot(
    { offer_set_id: offer.offerSetId, selected_slot_id: "not_in_offer" },
    WORKSPACE_ID,
  );
  assert.ok(badSlot.status === "INVALID_OFFER" || badSlot.status === "SLOT_UNAVAILABLE");

  const loaded = await import("../src/lib/voice-receptionist-wizard/offer-set-store").then((m) =>
    m.loadVoiceV2OfferSet(WORKSPACE_ID, offer.offerSetId),
  );
  assert.ok(loaded);
  assert.equal(loaded!.offerSetId, offer.offerSetId);

  console.log("BOOK_PROVIDER_MOCK_TEST=PASS");
  console.log("test-voice-v2-book-offered-slot-mock-headless: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
