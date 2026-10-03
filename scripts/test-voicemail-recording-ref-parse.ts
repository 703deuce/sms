/**
 * Run: npx tsx scripts/test-voicemail-recording-ref-parse.ts
 */
import assert from "node:assert/strict";
import { parseAnyVoicemailRecordingStorageRef } from "../src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

const colon = parseAnyVoicemailRecordingStorageRef("supabase:recordings:ws/vm-1.wav");
assert.deepEqual(colon, { bucket: "recordings", path: "ws/vm-1.wav" });

const slash = parseAnyVoicemailRecordingStorageRef("supabase://recordings/ws/vm-2.wav");
assert.deepEqual(slash, { bucket: "recordings", path: "ws/vm-2.wav" });

assert.equal(parseAnyVoicemailRecordingStorageRef("https://example.com/a.mp3"), null);

console.log("test-voicemail-recording-ref-parse: PASS");
