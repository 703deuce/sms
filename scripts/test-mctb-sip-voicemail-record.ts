/**
 * Hermetic tests for MCTB SIP voicemail recording bridge.
 * Run: npx tsx scripts/test-mctb-sip-voicemail-record.ts
 */
import assert from "node:assert/strict";
import {
  buildVoicemailStorageRecordingUrl,
  parseVoicemailStorageRecordingUrl,
} from "../src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

const storageUrl = buildVoicemailStorageRecordingUrl("call-recordings", "ws_1/2026/8/vm.mp3");
assert.equal(storageUrl, "supabase:call-recordings:ws_1/2026/8/vm.mp3");

const parsed = parseVoicemailStorageRecordingUrl(storageUrl);
assert.deepEqual(parsed, {
  bucket: "call-recordings",
  path: "ws_1/2026/8/vm.mp3",
});

assert.equal(parseVoicemailStorageRecordingUrl("https://example.com/a.mp3"), null);

console.log("test-mctb-sip-voicemail-record: ok");
