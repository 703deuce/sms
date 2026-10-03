/**
 * Voicemail inbox JSON envelope + field mapping contract.
 * Run: npx tsx scripts/test-voicemail-api-payload-parse.ts
 */
import assert from "node:assert/strict";
import {
  parseVoicemailApiPayload,
  unwrapVoicemailApiEnvelope,
} from "../src/lib/personal/voicemail-mappers";
import { mapPersonalVoicemailToMctbApi } from "../src/lib/newui-transplant/adapters/mctb-voicemail";

const inner = {
  messages: [
    {
      id: "vm_1",
      fromE164: "+15551234567",
      durationSeconds: 42,
      createdAt: "2026-10-01T12:00:00.000Z",
      transcriptText: "Hello",
      aiSummary: "Caller said hello",
      isRead: false,
      hasRecording: true,
      callerDisplayName: "Jane",
    },
  ],
  boxes: [],
  summary: { totalCount: 1, unreadCount: 1, minutesThisMonth: 1 },
};

const wrapped = { data: inner };
const parsedWrapped = parseVoicemailApiPayload(wrapped);
assert.equal(parsedWrapped.messages.length, 1);
assert.equal(parsedWrapped.messages[0].callerNumber, "+15551234567");
assert.equal(parsedWrapped.summary.totalCount, 1);

const parsedInner = parseVoicemailApiPayload(inner);
assert.equal(parsedInner.messages.length, 1);

assert.deepEqual(unwrapVoicemailApiEnvelope({ foo: 1 }), { foo: 1 });

const apiRow = mapPersonalVoicemailToMctbApi(parsedWrapped.messages[0]);
assert.equal(apiRow.fromE164, "+15551234567");
assert.equal(apiRow.transcript, "Hello");
assert.equal(apiRow.aiSummary, "Caller said hello");
assert.equal(apiRow.hasRecording, true);

console.log("test-voicemail-api-payload-parse: ok");
