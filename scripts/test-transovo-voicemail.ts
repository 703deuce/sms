/**
 * Hermetic voicemail finish-gap tests.
 * Run: npx tsx scripts/test-transovo-voicemail.ts
 */
import assert from "node:assert/strict";
import { mapVoicemailMessage } from "../src/lib/personal/voicemail-mappers";
import { translateVoicemailToEnglish } from "../src/lib/phone/voicemail-post-process";
import { voicemailTranscriptLooksLikeGreetingOnly } from "../src/lib/phone/voicemail-transcript-heuristics";

const mapped = mapVoicemailMessage({
  id: "vm1",
  fromE164: "+15551234567",
  durationSeconds: 42,
  createdAt: new Date("2026-01-01"),
  transcriptText: "Hola, necesito una cita",
  transcriptEnglish: "Hello, I need an appointment",
  aiSummary: "Caller needs an appointment.",
  isRead: false,
  boxId: "box1",
});
assert.equal(mapped.transcriptEnglish, "Hello, I need an appointment");
assert.equal(mapped.summary, "Caller needs an appointment.");

assert.equal(
  voicemailTranscriptLooksLikeGreetingOnly("This is a message from the MSI 1."),
  true,
);
assert.equal(
  voicemailTranscriptLooksLikeGreetingOnly("Hi, I need a quote for HVAC repair tomorrow."),
  false,
);

(async () => {
  const englishSkip = await translateVoicemailToEnglish("Hello there", "en");
  assert.equal(englishSkip, null);
  console.log("test-transovo-voicemail: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
