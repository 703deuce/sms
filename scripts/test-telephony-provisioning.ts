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
  resolvePlatformOutboundTrunkIdFromEnv,
  TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME,
} from "../src/lib/telephony/provisioning/livekit/outbound-trunk";
import { getVoicePipelineConfig } from "../src/lib/voice/runtime-provider/config";
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
const prevSipHost = process.env.LIVEKIT_SIP_HOST;
const prevSipUri = process.env.LIVEKIT_SIP_URI;
delete process.env.LIVEKIT_SIP_HOST;
delete process.env.LIVEKIT_SIP_URI;
process.env.LIVEKIT_URL = "sms-project.sip.livekit.cloud";
assert.equal(resolveLiveKitSipHost().source, "LIVEKIT_URL(sip)");
assert.equal(resolveLiveKitSipHost().host, "sms-project.sip.livekit.cloud");
process.env.LIVEKIT_URL = "wss://sms-project.livekit.cloud";
assert.equal(resolveLiveKitSipHost().source, "LIVEKIT_URL(derived)");
assert.equal(resolveLiveKitSipHost().host, "sms-project.sip.livekit.cloud");
process.env.LIVEKIT_URL = "wss://voice.example.com"; // pragma: allowlist secret
assert.equal(resolveLiveKitSipHost().source, "LIVEKIT_URL(self_hosted)");
assert.equal(resolveLiveKitSipHost().host, "voice.example.com");
process.env.LIVEKIT_URL = prevUrl;
if (prevSipHost) process.env.LIVEKIT_SIP_HOST = prevSipHost;
if (prevSipUri) process.env.LIVEKIT_SIP_URI = prevSipUri;

process.env.LIVEKIT_URL = "wss://sms-project.livekit.cloud";
process.env.LIVEKIT_SIP_URI = "stale-other.sip.livekit.cloud";
const prevMode = process.env.MEDIA_BACKEND_MODE;
const prevSelfHostedUrl = process.env.LIVEKIT_SELF_HOSTED_URL;
const prevSelfHostedHost = process.env.LIVEKIT_SELF_HOSTED_SIP_HOST;
delete process.env.MEDIA_BACKEND_MODE;
delete process.env.LIVEKIT_SELF_HOSTED_URL;
delete process.env.LIVEKIT_SELF_HOSTED_SIP_HOST;
delete process.env.LIVEKIT_SIP_HOST;
assert.equal(
  getAuthoritativeLiveKitSipHost().host,
  "stale-other.sip.livekit.cloud",
);
if (prevMode) process.env.MEDIA_BACKEND_MODE = prevMode;
if (prevSelfHostedUrl) process.env.LIVEKIT_SELF_HOSTED_URL = prevSelfHostedUrl;
if (prevSelfHostedHost) process.env.LIVEKIT_SELF_HOSTED_SIP_HOST = prevSelfHostedHost;
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

assert.equal(TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME, "transovo-telnyx-outbound");

const prevDefaultTrunk = process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID;
const prevLegacyTrunk = process.env.LIVEKIT_OUTBOUND_TRUNK_ID;
process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID = "ST_default";
process.env.LIVEKIT_OUTBOUND_TRUNK_ID = "ST_legacy";
assert.equal(resolvePlatformOutboundTrunkIdFromEnv(), "ST_default");
delete process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID;
assert.equal(resolvePlatformOutboundTrunkIdFromEnv(), "ST_legacy");
if (prevDefaultTrunk) process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID = prevDefaultTrunk;
else delete process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID;
if (prevLegacyTrunk) process.env.LIVEKIT_OUTBOUND_TRUNK_ID = prevLegacyTrunk;
else delete process.env.LIVEKIT_OUTBOUND_TRUNK_ID;

const partial = roomMetadataSchema.safeParse({ toE164: "+15715551234" });
assert.equal(partial.success, true);

const prevStt = process.env.VOICE_STT_PROVIDER;
const prevTts = process.env.VOICE_TTS_PROVIDER;
delete process.env.VOICE_STT_PROVIDER;
delete process.env.VOICE_TTS_PROVIDER;
const pipeline = getVoicePipelineConfig();
assert.equal(pipeline.sttProvider, "deepgram-plugin");
assert.equal(pipeline.sttModel, "deepgram/flux-general-en");
assert.equal(pipeline.ttsProvider, "elevenlabs-plugin");
assert.equal(pipeline.ttsModel, "eleven_flash_v2_5");
assert.equal(pipeline.ttsPreset, "elevenlabs");
assert.equal(pipeline.llmModel, "gpt-5-nano");
if (prevStt) process.env.VOICE_STT_PROVIDER = prevStt;
if (prevTts) process.env.VOICE_TTS_PROVIDER = prevTts;

console.log("telephony provisioning unit tests: PASS");
