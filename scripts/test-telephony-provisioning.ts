/**
 * Offline tests for telephony provisioning helpers.
 * Run: npx tsx scripts/test-telephony-provisioning.ts
 */
import assert from "node:assert/strict";
import {
  getAuthoritativeLiveKitSipHost,
  normalizeLiveKitSipHost,
  resolveLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";
import {
  toLiveKitInboundDid,
  trunkNumbersIncludeDid,
} from "../src/lib/telephony/provisioning/livekit/did";
import {
  getVoicePipelineConfig,
} from "../src/lib/voice/runtime-provider/config";
import {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
} from "../src/lib/telephony/provisioning/metadata";

assert.equal(
  normalizeLiveKitSipHost("sip:sms-abc123.sip.livekit.cloud"),
  "sms-abc123.sip.livekit.cloud",
);
assert.equal(
  normalizeLiveKitSipHost("sms-abc123.sip.livekit.cloud"),
  "sms-abc123.sip.livekit.cloud",
);

const prevUrl = process.env.LIVEKIT_URL;
process.env.LIVEKIT_URL = "sms-project.sip.livekit.cloud";
assert.equal(resolveLiveKitSipHost().source, "LIVEKIT_URL(sip)");
assert.equal(resolveLiveKitSipHost().host, "sms-project.sip.livekit.cloud");
process.env.LIVEKIT_URL = "wss://sms-project.livekit.cloud";
assert.equal(resolveLiveKitSipHost().source, "LIVEKIT_URL(derived)");
assert.equal(resolveLiveKitSipHost().host, "sms-project.sip.livekit.cloud");
process.env.LIVEKIT_URL = prevUrl;

const prevSipUri = process.env.LIVEKIT_SIP_URI;
process.env.LIVEKIT_URL = "wss://sms-project.livekit.cloud";
process.env.LIVEKIT_SIP_URI = "stale-other.sip.livekit.cloud";
assert.equal(
  getAuthoritativeLiveKitSipHost().host,
  "stale-other.sip.livekit.cloud",
);
process.env.LIVEKIT_SIP_URI = prevSipUri;

assert.equal(toLiveKitInboundDid("+18663464256"), "+18663464256");
assert.equal(trunkNumbersIncludeDid(["+18663464256"], "+18663464256"), true);
assert.equal(trunkNumbersIncludeDid(["18663464256"], "+18663464256"), true);

assert.equal(
  parseRoomMetadata(JSON.stringify({ toE164: "+18663464256" }))?.toE164,
  "+18663464256",
);

assert.equal(
  parseDispatchAttributes({
    "sip.trunkPhoneNumber": "+18663464256",
    "sip.phoneNumber": "+14155550100",
  })?.toE164,
  "+18663464256",
);

assert.equal(
  parseDispatchAttributes({
    "sip.trunkNumber": "+18663464256",
    "sip.phoneNumber": "+14155550100",
  })?.toE164,
  "+18663464256",
);

const partial = roomMetadataSchema.safeParse({ toE164: "+15715551234" });
assert.equal(partial.success, true);

const prevStt = process.env.VOICE_STT_PROVIDER;
const prevTts = process.env.VOICE_TTS_PROVIDER;
delete process.env.VOICE_STT_PROVIDER;
delete process.env.VOICE_TTS_PROVIDER;
const pipeline = getVoicePipelineConfig();
assert.equal(pipeline.sttProvider, "inference");
assert.equal(pipeline.sttModel, "deepgram/nova-3");
assert.equal(pipeline.ttsProvider, "elevenlabs");
assert.equal(pipeline.ttsModel, "elevenlabs/eleven_flash_v2_5");
assert.equal(pipeline.ttsPreset, "elevenlabs");
assert.equal(pipeline.llmModel, "gpt-5-nano");
if (prevStt) process.env.VOICE_STT_PROVIDER = prevStt;
if (prevTts) process.env.VOICE_TTS_PROVIDER = prevTts;

console.log("telephony provisioning unit tests: PASS");
