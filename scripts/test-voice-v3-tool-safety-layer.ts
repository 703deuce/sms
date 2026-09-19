/**
 * Phase 19D — Transovo rejects hallucinated identifiers (no Astra required).
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { executeVoiceTool } from "../src/lib/voice-v3/tools/execute-voice-tool";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

function noopSend(): void {}

async function main() {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_safety",
    callId: "call_safety",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });

  const ctx = {
    callId: "call_safety",
    liveSessionId: "live_safety",
    delegationId: null,
    functionCallId: "fc_book_fake",
    runtime,
    tenantId: "call_safety",
    sendContext: noopSend,
  };

  const book = await executeVoiceTool(ctx, "book_appointment", {
    offer_set_id: "fake_offer",
    slot_id: "fake_slot",
  });
  assert.equal(book.ok, false);
  if (!book.ok) {
    assert.ok(
      book.code === "STALE_OFFER_SET" || book.code === "INVALID_IDENTIFIER",
      `expected stale/invalid book rejection, got ${book.code}`,
    );
  }

  const cancel = await executeVoiceTool(ctx, "cancel_appointment", {
    appointment_selection_id: "fake_appt",
    confirmed: true,
  });
  assert.equal(cancel.ok, false);
  if (!cancel.ok) {
    assert.equal(cancel.code, "APPOINTMENT_NOT_FOUND");
  }

  clearVoiceV3CallRuntimeStore();
  console.log("PASS voice-v3 tool safety layer");
}

main().catch((err) => {
  console.error("FAIL voice-v3 tool safety layer", err);
  process.exit(1);
});
