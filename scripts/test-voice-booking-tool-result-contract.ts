#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  formatVoiceAiBookingToolResponse,
  voiceBookingResponseFromSyncTurn,
} from "../src/lib/voice/ai-booking/tool-result-contract";

const pending = formatVoiceAiBookingToolResponse({
  status: "OPERATION_PENDING",
  speak: "Absolutely — give me just a moment while I check the calendar.",
  operationId: "op_1",
});
assert.equal(pending.voice_booking_status, "OPERATION_PENDING");
assert.ok(pending.agent_instruction);

const avail = voiceBookingResponseFromSyncTurn({
  ok: true,
  speak: "We have 1, 2, and 3 PM. Which works?",
  data: {
    slots: [
      { slot_id: "s1", label: "1:00 PM", index: 1 },
      { slot_id: "s2", label: "2:00 PM", index: 2 },
    ],
  },
});
assert.equal(avail.voice_booking_status, "AVAILABILITY_FOUND");
assert.equal((avail.slots as unknown[]).length, 2);

console.log("test-voice-booking-tool-result-contract: ok");
