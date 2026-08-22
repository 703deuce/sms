/**
 * Fixture tests for MCTB Telnyx→Twilio voice bridge (no live providers).
 *
 * Run: npx tsx scripts/test-mctb-voice-bridge.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  captureMctbVoiceBridgeFirstHop,
  correlateTwilioIngressToFirstHop,
  createBridgeCorrelationToken,
  isMctb571InboundTarget,
  resetMctbVoiceBridgeForTests,
} from "../src/lib/mctb/voice-bridge/first-hop";
import {
  handleMctbVoiceBridgeTelnyxEvent,
  resetMctbVoiceBridgeHandlerStateForTests,
} from "../src/lib/mctb/voice-bridge/telnyx-handler";
import {
  buildMctbTwilioIngressDiagnosticTwiml,
  handleMctbTwilioIngressVoice,
} from "../src/lib/mctb/voice-bridge/twilio-ingress";
import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_TWILIO_VOICE_INGRESS_E164,
} from "../src/lib/mctb/onboarding/constants";
import { validateTwilioSignature } from "../src/lib/messaging/twilio-client";
import twilio from "twilio";
import { parseTelnyxForwardedFrom } from "../src/lib/voice/telnyx/forwarded-from";

const CALL_ID = "mock_v3:mctb-voice-bridge-test";
const WORKSPACE = "cmt2zyg4l43373s0f146b442h";
// Synthetic fixture numbers (valid E164 digits only; physical cert uses live payloads).
const TEST_CALLER_E164 = "+12025550101";
const TEST_BUSINESS_E164 = "+12025550102";

const baseTelnyxPayload = {
  call_control_id: CALL_ID,
  call_session_id: "sess-bridge-001",
  call_leg_id: "leg-bridge-001",
  connection_id: "conn-bridge-001",
  from: TEST_CALLER_E164,
  to: MCTB_PLATFORM_DEMO_E164,
  direction: "incoming",
  sip_headers: [
    {
      name: "Diversion",
      value: `<sip:${TEST_BUSINESS_E164.replace("+", "")}@one.att.net;user=phone>;reason=no-answer`,
    },
  ],
};

function testTwilioSignatureVerification() {
  const authToken = "test_auth_token_for_fixture";
  const url = ["https:/", "/example.com/api/twilio/voice/mctb-ingress"].join("");
  const params = {
    CallSid: "CA_fixture_sig",
    From: TEST_CALLER_E164,
    To: MCTB_TWILIO_VOICE_INGRESS_E164,
    Direction: "inbound",
    CallStatus: "ringing",
  };

  const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
  assert.equal(validateTwilioSignature(authToken, signature, url, params), true);
  assert.equal(validateTwilioSignature(authToken, "bad-signature", url, params), false);
}

function testRollbackScriptConfig() {
  const rollbackPath = join(process.cwd(), "scripts/mctb-rollback-571-twilio-voice-bridge.ts");
  const setupPath = join(process.cwd(), "scripts/mctb-setup-571-twilio-voice-bridge.ts");
  assert.ok(existsSync(rollbackPath), "rollback script exists");
  assert.ok(existsSync(setupPath), "setup script exists");

  const rollbackSource = readFileSync(rollbackPath, "utf8");
  assert.match(rollbackSource, /assign571ToConnection/);
  assert.match(rollbackSource, /\.mctb-571-voice-bridge-backup\.json/);
  assert.match(rollbackSource, /--apply/);
}

async function main() {
  const forwarded = parseTelnyxForwardedFrom(baseTelnyxPayload);
  assert.equal(forwarded, TEST_BUSINESS_E164);

  assert.equal(isMctb571InboundTarget(MCTB_PLATFORM_DEMO_E164), true);
  assert.equal(isMctb571InboundTarget("+15551234567"), false);

  const token = createBridgeCorrelationToken();
  assert.ok(token.token.length > 10);
  assert.ok(token.tokenHash.length === 64);

  const twiml = buildMctbTwilioIngressDiagnosticTwiml();
  assert.match(twiml, /Transovo test/);
  assert.match(twiml, /<Hangup\/>/);

  testTwilioSignatureVerification();
  testRollbackScriptConfig();

  await resetMctbVoiceBridgeForTests();
  resetMctbVoiceBridgeHandlerStateForTests();

  const initiated = await handleMctbVoiceBridgeTelnyxEvent({
    eventType: "call.initiated",
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(initiated.handled, true);
  assert.equal(initiated.action, "answer");

  const answered = await handleMctbVoiceBridgeTelnyxEvent({
    eventType: "call.answered",
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(answered.handled, true);
  assert.equal(answered.action, "capture_and_transfer");
  assert.ok(answered.callEventId);

  await handleMctbVoiceBridgeTelnyxEvent({
    eventType: "call.initiated",
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  await handleMctbVoiceBridgeTelnyxEvent({
    eventType: "call.answered",
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });

  const hangup = await handleMctbVoiceBridgeTelnyxEvent({
    eventType: "call.hangup",
    eventPayload: { ...baseTelnyxPayload, hangup_cause: "normal_clearing" },
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(hangup.handled, true);

  await resetMctbVoiceBridgeForTests();
  const first = await captureMctbVoiceBridgeFirstHop({
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  const dup = await captureMctbVoiceBridgeFirstHop({
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(first.created, true);
  assert.equal(dup.created, false);
  assert.equal(first.callEventId, dup.callEventId);

  const twilioIngress = await handleMctbTwilioIngressVoice({
    CallSid: "CA_test_bridge_ingress",
    From: TEST_CALLER_E164,
    To: MCTB_TWILIO_VOICE_INGRESS_E164,
    Direction: "inbound",
    CallStatus: "ringing",
    ForwardedFrom: TEST_BUSINESS_E164,
  });
  assert.match(twilioIngress.twiml, /Transovo test/);
  assert.equal(twilioIngress.resolvedCallEventId, first.callEventId);
  assert.equal(twilioIngress.correlationMethod, "ani_to_timestamp_window");

  const correlated = await correlateTwilioIngressToFirstHop({
    callSid: "CA_test_bridge_001",
    fromE164: TEST_CALLER_E164,
    toE164: MCTB_TWILIO_VOICE_INGRESS_E164,
    forwardedFromE164: null,
  });
  assert.equal(correlated.callEventId, null);
  assert.equal(correlated.correlationMethod, "ani_to_timestamp_window_miss");

  await resetMctbVoiceBridgeForTests();
  const second = await captureMctbVoiceBridgeFirstHop({
    eventPayload: baseTelnyxPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  const correlatedSecond = await correlateTwilioIngressToFirstHop({
    callSid: "CA_test_bridge_001",
    fromE164: TEST_CALLER_E164,
    toE164: MCTB_TWILIO_VOICE_INGRESS_E164,
    forwardedFromE164: null,
  });
  assert.equal(correlatedSecond.callEventId, second.callEventId);
  assert.equal(correlatedSecond.correlationMethod, "ani_to_timestamp_window");

  const duplicateTwilio = await correlateTwilioIngressToFirstHop({
    callSid: "CA_test_bridge_001",
    fromE164: TEST_CALLER_E164,
    toE164: MCTB_TWILIO_VOICE_INGRESS_E164,
  });
  assert.equal(duplicateTwilio.callEventId, second.callEventId);
  assert.equal(duplicateTwilio.correlationMethod, "twilio_call_sid_idempotent");

  const miss = await correlateTwilioIngressToFirstHop({
    callSid: "CA_test_bridge_miss",
    fromE164: "+15559998888",
    toE164: MCTB_TWILIO_VOICE_INGRESS_E164,
  });
  assert.equal(miss.callEventId, null);
  assert.equal(miss.correlationMethod, "ani_to_timestamp_window_miss");

  console.log("test-mctb-voice-bridge: ok");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
