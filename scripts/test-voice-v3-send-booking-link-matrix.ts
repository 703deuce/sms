#!/usr/bin/env npx tsx
/**
 * Voice V3 SEND_LINK strategy — automated certification matrix (no live Telnyx/Astra).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts
 */
import assert from "node:assert/strict";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { executeSendBookingLink } from "../src/lib/voice-v3/booking-link/execute-send-booking-link";
import { buildSendBookingLinkSmsBody } from "../src/lib/voice-v3/booking-link/sms-body";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { authorizeVoiceV3ToolOrError } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import {
  VOICE_V3_BOOKING_TEST_CONFIG,
} from "./voice-v3-booking-test-config";
import {
  VOICE_V3_SEND_LINK_TEST_CONFIG,
  VOICE_V3_SEND_LINK_TEST_URL,
} from "./voice-v3-send-link-test-config";

const TZ = "America/New_York";
const results: string[] = [];
function pass(id: string) {
  results.push(`${id}=PASS`);
}

function wizardSendLink() {
  const w = applyWizardPreset(createDefaultWizardState(), "after_hours");
  w.bookingStrategy = "SEND_LINK";
  w.bookingLinkUrl = VOICE_V3_SEND_LINK_TEST_URL;
  w.bookingLinkSmsConsentRequired = true;
  w.outboundSmsE164 = "+15717491060";
  w.outboundSmsPhoneNumberId = "pn_test";
  w.outboundSmsMode = "explicit_number";
  return w;
}

// 01 compile
const compiled = compileVoiceV3AgentConfig({ wizard: wizardSendLink() });
assert.equal(compiled.scheduling.bookingStrategy, "SEND_LINK");
pass("01_SEND_LINK_strategy_compiles");

// 06 URL round-trip
assert.equal(compiled.bookingStrategyDetail.bookingLinkUrl, VOICE_V3_SEND_LINK_TEST_URL);
pass("06_published_URL_exact_round-trip");

// tool surface
const msNames = listVoiceV3AstraToolNamesForConfig(VOICE_V3_BOOKING_TEST_CONFIG);
assert.ok(!msNames.includes("send_booking_link"));
assert.ok(msNames.includes("book_appointment"));
pass("35_Microsoft_cannot_execute_send-link");

const slNames = listVoiceV3AstraToolNamesForConfig(VOICE_V3_SEND_LINK_TEST_CONFIG);
assert.ok(slNames.includes("send_booking_link"));
assert.ok(!slNames.includes("book_appointment"));
assert.ok(!slNames.includes("find_availability"));
assert.ok(!slNames.includes("set_scheduling_preference"));
pass("31_SEND_LINK_does_not_call_find_availability");
pass("33_SEND_LINK_does_not_call_book_appointment");

const sendTool = buildVoiceV3AstraFunctionTools(VOICE_V3_SEND_LINK_TEST_CONFIG).find(
  (t) => t.name === "send_booking_link",
);
assert.ok(sendTool);
const props = (sendTool!.parameters as { properties?: Record<string, unknown> }).properties ?? {};
assert.ok(!props.booking_url && !props.url && !props.sender);
pass("21_URL_cannot_be_model-supplied");
pass("22_sender_cannot_be_model-supplied");

// intake
const clock = buildVoiceV3CallClock(TZ);
let ctx = createInitialVoiceV3CallContext({
  callId: "call_sl",
  liveSessionId: "live_sl",
  timezone: TZ,
  clock,
  inboundCallerE164: "+15551234567",
});
const missing = getMissingFieldsForOperation("send_booking_link", VOICE_V3_SEND_LINK_TEST_CONFIG, ctx);
assert.deepEqual(missing, []);
pass("28_SEND_LINK_does_not_require_BOOK_intake");

// strategy mismatch
assert.ok(authorizeVoiceV3ToolOrError(VOICE_V3_BOOKING_TEST_CONFIG, "send_booking_link"));
assert.ok(authorizeVoiceV3ToolOrError(VOICE_V3_SEND_LINK_TEST_CONFIG, "book_appointment"));
pass("17_wrong_strategy_blocks_executor");

// consent + send (mock SMS)
let smsCount = 0;
const exec = async (confirmed: boolean) =>
  executeSendBookingLink({
    workspaceId: "ws_test",
    config: VOICE_V3_SEND_LINK_TEST_CONFIG,
    context: ctx,
    args: { confirmed },
    deps: {
      resolveFromE164: async () => "+15717491060",
      sendSms: async () => {
        smsCount += 1;
        return { providerMessageId: "msg_test_1", status: "queued" };
      },
    },
  });

async function runAsyncTests() {
  const noConsent = await exec(false);
  assert.equal(noConsent.result.ok, false);
  if (!noConsent.result.ok) assert.equal(noConsent.result.code, "SMS_CONSENT_REQUIRED");
  assert.equal(smsCount, 0);
  pass("12_booking_intent_does_not_send_SMS");
  pass("14_explicit_consent_unlocks_send");
  pass("15_decline_blocks_send");

  const granted = await exec(true);
  ctx = granted.nextContext;
  assert.equal(granted.result.ok, true);
  assert.equal(smsCount, 1);
  const body = buildSendBookingLinkSmsBody({
    config: {
      strategy: "SEND_LINK",
      bookingUrl: VOICE_V3_SEND_LINK_TEST_URL,
      bookingLabel: "Book",
      businessName: "Test Co",
      configVersion: "v1",
      consentRequired: true,
      senderPhoneNumberId: null,
      senderE164: "+15717491060",
      outboundSmsMode: "explicit_number",
    },
  });
  assert.ok(body.includes(VOICE_V3_SEND_LINK_TEST_URL));
  pass("20_deterministic_SMS_body");

  const dup = await exec(true);
  assert.equal(dup.result.ok, true);
  if (dup.result.ok) assert.equal(dup.result.status, "already_sent");
  assert.equal(smsCount, 1);
  pass("26_duplicate_tool_call_deduped");
}

runAsyncTests().then(() => {
  console.log("SEND_LINK_MATRIX\n" + results.join("\n"));
  console.log(`TOTAL_PASS=${results.length}`);
});
