#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  formatVoiceAiBookingToolResponse,
  voiceBookingResponseFromSyncTurn,
  voiceBookingResponseFromDurableTurn,
} from "../src/lib/voice/ai-booking/tool-result-contract";
import { voiceBookingResponseFromDurableOperation } from "../src/lib/voice/ai-booking/tool-result-contract";

async function main() {
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

  const durableSucceeded = voiceBookingResponseFromDurableTurn({
    operationStatus: "SUCCEEDED",
    speak: "I have 1:00 PM, 2:00 PM, or 3:00 PM. Which works best?",
    operationId: "op_ms_slots",
    ok: true,
    data: {
      voice: {
        ok: true,
        speak: "I have 1:00 PM, 2:00 PM, or 3:00 PM. Which works best?",
        data: {
          slots: [
            { slot_id: "s1", label: "1:00 PM", index: 1 },
            { slot_id: "s2", label: "2:00 PM", index: 2 },
            { slot_id: "s3", label: "3:00 PM", index: 3 },
          ],
        },
      },
    },
  });
  assert.equal(durableSucceeded.voice_booking_status, "AVAILABILITY_FOUND");
  assert.equal(durableSucceeded.ok, true);
  assert.equal((durableSucceeded.slots as unknown[]).length, 3);

  const authoritative = voiceBookingResponseFromDurableOperation({
    id: "op_ms_slots",
    workspaceId: "ws_1",
    conversationId: null,
    voiceCallId: "call_1",
    operationType: "VOICE_AI_BOOKING_TURN",
    stateVersion: null,
    idempotencyKey: "k",
    status: "SUCCEEDED",
    attemptCount: 1,
    claimedAt: null,
    claimLeaseExpiresAt: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
    completedAt: new Date().toISOString(),
    inputJson: {},
    resultJson: {
      voice: {
        ok: true,
        speak: "I have 1:00 PM, 2:00 PM, or 3:00 PM. Which works best?",
        data: {
          slots: [
            { slot_id: "s1", label: "1:00 PM" },
            { slot_id: "s2", label: "2:00 PM" },
            { slot_id: "s3", label: "3:00 PM" },
          ],
        },
      },
    },
    failureClass: null,
    failureDetail: null,
    traceJson: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(authoritative.voice_booking_status, "AVAILABILITY_FOUND");
  assert.equal(authoritative.ok, true);
  assert.notEqual(authoritative.voice_booking_status, "PROVIDER_TEMPORARY_FAILURE");

  console.log("test-voice-booking-tool-result-contract: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
