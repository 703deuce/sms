#!/usr/bin/env npx tsx
/**
 * Voice V3 callback + shared facts matrix (deterministic, no live PSTN).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
 */
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { mergeIntakeUpdate } from "../src/lib/voice-v3/intake-objective";
import { executeRequestCallback } from "../src/lib/voice-v3/callback/execute-request-callback";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { VOICE_V3_SEND_LINK_TEST_CONFIG } from "./voice-v3-send-link-test-config";
import { authorizeVoiceV3ToolOrError } from "../src/lib/voice-v3/tools/authorize-tool-for-config";

const TZ = "America/New_York";
const results: string[] = [];
function pass(id: string) {
  results.push(`${id}=PASS`);
}

function wizardWithStrategy(strategy: "NONE" | "MICROSOFT_365" | "SEND_LINK", callbackOn: boolean) {
  const w = applyWizardPreset(createDefaultWizardState(), "after_hours");
  w.bookingStrategy = strategy;
  if (strategy === "SEND_LINK") {
    w.bookingLinkUrl = "https://example.com/book";
    w.outboundSmsE164 = "+15717491060";
    w.outboundSmsPhoneNumberId = "pn_test";
  }
  w.callbackRequestsEnabled = callbackOn;
  if (strategy === "MICROSOFT_365") {
    w.capabilities = ["book_appointments", "reschedule", "cancel", "answer_questions"];
  } else if (strategy === "SEND_LINK") {
    w.capabilities = ["answer_questions", "send_sms_confirmations"];
  } else {
    w.capabilities = ["answer_questions"];
    w.bookingStrategy = "NONE";
  }
  return w;
}

// Config compile
const noneCb = compileVoiceV3AgentConfig({ wizard: wizardWithStrategy("NONE", true) });
assert.ok(noneCb.operationRequirements?.request_callback?.includes("name"));
pass("01_no_booking_callback_enabled");

const msCb = compileVoiceV3AgentConfig({
  wizard: wizardWithStrategy("MICROSOFT_365", true),
  providerConnections: { microsoftConnectionId: "conn_test" },
});
assert.ok(msCb.operationRequirements?.book_appointment?.length);
assert.ok(msCb.operationRequirements?.request_callback?.length);
pass("02_microsoft_plus_callback");

const slCb = compileVoiceV3AgentConfig({ wizard: wizardWithStrategy("SEND_LINK", true) });
pass("03_send_link_plus_callback");

const cbOff = compileVoiceV3AgentConfig({ wizard: wizardWithStrategy("NONE", false) });
assert.equal(cbOff.callHandling.callbackRequestsEnabled, false);
pass("04_callback_disabled");

// Tool catalog matrix
const namesNoneCb = listVoiceV3AstraToolNamesForConfig(noneCb);
assert.ok(namesNoneCb.includes("request_callback"));
assert.ok(!namesNoneCb.includes("book_appointment"));
pass("07_none_plus_callback_tool_present");

const msNames = listVoiceV3AstraToolNamesForConfig(VOICE_V3_BOOKING_TEST_CONFIG);
assert.ok(msNames.includes("request_callback"));
assert.ok(msNames.includes("book_appointment"));
pass("08_microsoft_and_callback");

const slNames = listVoiceV3AstraToolNamesForConfig(VOICE_V3_SEND_LINK_TEST_CONFIG);
assert.ok(slNames.includes("request_callback"));
assert.ok(slNames.includes("send_booking_link"));
pass("09_send_link_and_callback");

const disabledNames = listVoiceV3AstraToolNamesForConfig({
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: { ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling, callbackRequestsEnabled: false },
});
assert.ok(!disabledNames.includes("request_callback"));
pass("10_callback_disabled_absent");

// Shared facts reuse
const clock = buildVoiceV3CallClock(TZ);
const config = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: { ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling, callbackRequestsEnabled: true },
  intakeFields: [
    ...VOICE_V3_BOOKING_TEST_CONFIG.intakeFields,
    {
      key: "service_reason",
      label: "Reason",
      type: "text" as const,
      required: false,
      description: "Why the caller is calling.",
    },
  ],
  operationRequirements: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.operationRequirements,
    request_callback: ["name", "phone", "service_reason"],
  },
};
let ctx = createInitialVoiceV3CallContext({
  callId: "call_cb",
  liveSessionId: "live_cb",
  timezone: TZ,
  clock,
  inboundCallerE164: "+15551234567",
});
const merged = mergeIntakeUpdate({
  current: {},
  update: { name: "Anthony", service_reason: "Water heater" },
  config,
  at: new Date(),
  sourceCallId: "call_cb",
  sourceDelegationId: null,
});
ctx = { ...ctx, intake: { values: merged.values } };
const missingBeforeReason = getMissingFieldsForOperation("request_callback", config, ctx);
assert.deepEqual(missingBeforeReason, []);
pass("13_name_reused");
pass("15_reason_reused");
pass("16_ani_as_phone");

const bookMissing = getMissingFieldsForOperation("book_appointment", config, ctx);
assert.ok(bookMissing.includes("email"));
pass("21_booking_still_needs_booking_fields");

const slMissing = getMissingFieldsForOperation("send_booking_link", VOICE_V3_SEND_LINK_TEST_CONFIG, ctx);
assert.deepEqual(slMissing, []);
pass("23_send_link_no_booking_intake");

async function runPersistence() {
  let persistCount = 0;
  const exec = () =>
    executeRequestCallback({
      workspaceId: "ws_cb",
      agentId: "agent_cb",
      config,
      context: ctx,
      args: {
        callback_phone: null,
        reason: null,
        preferred_time: null,
        notes: null,
      },
      deps: {
        persist: async () => {
          persistCount += 1;
          return { ok: true, callbackRequestId: "cb_req_1", duplicate: false };
        },
      },
    });

  const first = await exec();
  assert.equal(first.result.ok, true);
  ctx = first.nextContext;
  assert.equal(persistCount, 1);
  pass("31_valid_callback_persisted");

  const second = await exec();
  assert.equal(second.result.ok, true);
  assert.equal(persistCount, 1);
  pass("32_retry_deduped");

  const disabled = await executeRequestCallback({
    workspaceId: "ws_cb",
    agentId: "agent_cb",
    config: {
      ...config,
      callHandling: { ...config.callHandling, callbackRequestsEnabled: false },
    },
    context: ctx,
    args: {
      callback_phone: null,
      reason: "test",
      preferred_time: null,
      notes: null,
    },
  });
  assert.equal(disabled.result.ok, true);
  if (disabled.result.ok) assert.equal(disabled.result.data?.status, "not_available");
  pass("34_disabled_no_persist");

  assert.ok(authorizeVoiceV3ToolOrError(VOICE_V3_SEND_LINK_TEST_CONFIG, "send_booking_link") === null);
  pass("12_send_link_unchanged");
}

runPersistence()
  .then(() => {
    console.log("CALLBACK_MATRIX\n" + results.join("\n"));
    console.log(`TOTAL_PASS=${results.length}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
