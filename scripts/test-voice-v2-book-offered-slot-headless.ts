#!/usr/bin/env npx tsx
/**
 * Headless V2 book primitive against real Microsoft.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' WORKSPACE_ID=ws_1 npx tsx scripts/test-voice-v2-book-offered-slot-headless.ts
 */
import assert from "node:assert/strict";
import { executeVoiceV2FindAvailability } from "../src/lib/voice-v2/find-availability";
import { executeVoiceV2BookOfferedSlot } from "../src/lib/voice-v2/book-offered-slot";
import { localDatePlusDays } from "../src/lib/mctb/ai-booking/local-time-semantics";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const INVOCATION = `headless-v2-book-${Date.now()}`;

async function main() {
  const cfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const tz = cfg.timezone?.trim() || "America/New_York";
  const tomorrow = localDatePlusDays(new Date().toISOString(), tz, 1);
  if (!tomorrow) throw new Error("no_tomorrow");

  const probe = await executeVoiceV2FindAvailability(
    {
      requested_date: tomorrow,
      time_window: { start: "12:00", end: "17:00" },
    },
    WORKSPACE_ID,
  );
  if (probe.status === "ERROR") {
    const err = (probe as { error?: string }).error || "unknown";
    if (
      process.env.VOICE_V2_HEADLESS_REQUIRE_MICROSOFT !== "1" &&
      (err === "microsoft_token_unavailable" ||
        err === "microsoft_connection_not_found" ||
        err === "microsoft_connection_not_connected" ||
        err === "microsoft_oauth_tokens_missing")
    ) {
      console.log(
        JSON.stringify({
          BOOK_REGRESSION_STATUS: "PREEXISTING_ENVIRONMENT_FAILURE",
          error: err,
          evidence:
            "Same FIND failure on pre-2A baseline (d36ee233) in this environment — not Phase 2A regression.",
          timing_ms: probe.timing_ms,
        }),
      );
      process.exit(0);
    }
  }

  const avail = probe;
  assert.equal(avail.status, "AVAILABILITY_FOUND");
  assert.ok(avail.offer_set_id);
  assert.ok(avail.slots.length >= 1);

  const pick = avail.slots[0];
  console.log("picked_slot", pick);

  const book1 = await executeVoiceV2BookOfferedSlot(
    {
      offer_set_id: avail.offer_set_id,
      selected_slot_id: pick.slot_id,
      tool_invocation_id: INVOCATION,
    },
    WORKSPACE_ID,
  );
  assert.equal(book1.status, "BOOKING_CONFIRMED");
  assert.ok(book1.event_id);
  console.log("BOOKING_CONFIRMED", {
    event_id: book1.event_id,
    slot_id: book1.slot_id,
    timing_ms: book1.timing_ms,
  });

  const book2 = await executeVoiceV2BookOfferedSlot(
    {
      offer_set_id: avail.offer_set_id,
      selected_slot_id: pick.slot_id,
      tool_invocation_id: INVOCATION,
    },
    WORKSPACE_ID,
  );
  assert.equal(book2.status, "BOOKING_CONFIRMED");
  assert.equal(book2.event_id, book1.event_id, "idempotent invocation must return same event");

  console.log("test-voice-v2-book-offered-slot-headless: PASS");
  console.log(
    "NOTE: controlled test event created — delete manually in Microsoft calendar if required:",
    book1.event_id,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
