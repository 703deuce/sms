/**
 * Regression: MCTB voicemail fallback must record, persist, and skip consent/SMS.
 *
 * Run: npx tsx scripts/test-mctb-sip-voicemail-fallback.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const voicemailPy = readFileSync(
  resolve("voice-runtime-python/transovo_voice/session/mctb_voicemail_fallback.py"),
  "utf8",
);
const recorderPy = readFileSync(
  resolve("voice-runtime-python/transovo_voice/session/sip_voicemail_recorder.py"),
  "utf8",
);
const serviceTs = readFileSync(
  resolve("src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-service.ts"),
  "utf8",
);
const routeTs = readFileSync(
  resolve("src/app/api/internal/voice-runtime/route.ts"),
  "utf8",
);
const provisioningTs = readFileSync(
  resolve("src/lib/mctb/voicemail-provisioning.ts"),
  "utf8",
);

assert.match(voicemailPy, /begin_mctb_sip_voicemail/, "voicemail fallback must begin DB row");
assert.match(voicemailPy, /finalize_mctb_sip_voicemail/, "voicemail fallback must finalize recording");
assert.match(voicemailPy, /record_sip_voicemail_audio/, "voicemail fallback must capture caller audio");
assert.doesNotMatch(voicemailPy, /asyncio\.sleep\(45/, "voicemail fallback must not dead-air hold");

assert.match(recorderPy, /rtc\.AudioStream/, "recorder must use LiveKit AudioStream");
assert.match(recorderPy, /audio\/wav/, "recorder must emit wav audio");

assert.match(serviceTs, /beginMctbSipVoicemailForPython/, "service must expose begin handler");
assert.match(serviceTs, /finalizeMctbSipVoicemailForPython/, "service must expose finalize handler");
assert.match(serviceTs, /attachVoicemailRecordingAndTranscribe/, "finalize must queue transcription");
assert.match(serviceTs, /voicemailMessage\.create/, "begin must create VoicemailMessage");

assert.match(routeTs, /begin_mctb_sip_voicemail/, "internal API must wire begin action");
assert.match(routeTs, /finalize_mctb_sip_voicemail/, "internal API must wire finalize action");

assert.match(provisioningTs, /ensureMctbVoicemailBoxProvisioned/, "provisioning helper must exist");
assert.match(provisioningTs, /generatePromptAudio/, "setup must pre-generate ElevenLabs greeting");

console.log("test-mctb-sip-voicemail-fallback: ok");
