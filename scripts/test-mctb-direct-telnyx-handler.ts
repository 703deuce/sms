/**
 * Fixture tests for MCTB direct Telnyx test handler (no live Telnyx API).
 *
 * Run: npx tsx scripts/test-mctb-direct-telnyx-handler.ts
 */
import assert from "node:assert/strict";
import { MCTB_TWILIO_VOICE_INGRESS_E164 } from "../src/lib/mctb/onboarding/constants";
import {
  handleMctbDirectTelnyxTestEvent,
  resetMctbDirectTelnyxTestStateForTests,
} from "../src/lib/mctb/direct-telnyx-test/handler";

const CALL_ID = "mock_v3:test-direct-telnyx";

const basePayload = {
  call_control_id: CALL_ID,
  call_session_id: "sess-direct-test-001",
  call_leg_id: "leg-direct-test-001",
  connection_id: "3022029259041408870",
  from: "+1test-caller-0001",
  to: MCTB_TWILIO_VOICE_INGRESS_E164,
  direction: "incoming",
  sip_headers: [
    {
      name: "Diversion",
      value: "<sip:+1test-forward-0001@example.com>;reason=no-answer",
    },
    { name: "Supported", value: "100rel" },
  ],
};

async function withTestEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.MCTB_DIRECT_TELNYX_TEST;
  process.env.MCTB_DIRECT_TELNYX_TEST = "1";
  process.env.MCTB_DIRECT_TELNYX_TEST_HOLD_MS = "50";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.MCTB_DIRECT_TELNYX_TEST;
    else process.env.MCTB_DIRECT_TELNYX_TEST = prev;
    delete process.env.MCTB_DIRECT_TELNYX_TEST_HOLD_MS;
  }
}

async function main() {
  await withTestEnv(async () => {
    resetMctbDirectTelnyxTestStateForTests();

    const initiated = await handleMctbDirectTelnyxTestEvent({
      eventType: "call.initiated",
      eventPayload: basePayload,
    });
    assert.equal(initiated.handled, true);
    assert.equal(initiated.action, "answer");

    const answered = await handleMctbDirectTelnyxTestEvent({
      eventType: "call.answered",
      eventPayload: basePayload,
    });
    assert.equal(answered.handled, true);
    assert.equal(answered.action, "speak_and_hold");

    const hangup = await handleMctbDirectTelnyxTestEvent({
      eventType: "call.hangup",
      eventPayload: { ...basePayload, hangup_cause: "normal_clearing" },
    });
    assert.equal(hangup.handled, true);
    assert.equal(hangup.action, "hangup_observed");

    const wrongTo = await handleMctbDirectTelnyxTestEvent({
      eventType: "call.initiated",
      eventPayload: { ...basePayload, to: "+15551234567" },
    });
    assert.equal(wrongTo.handled, false);

    resetMctbDirectTelnyxTestStateForTests();
  });

  process.env.MCTB_DIRECT_TELNYX_TEST = "0";
  resetMctbDirectTelnyxTestStateForTests();
  const disabled = await handleMctbDirectTelnyxTestEvent({
    eventType: "call.initiated",
    eventPayload: basePayload,
  });
  assert.equal(disabled.handled, false);

  console.log("test-mctb-direct-telnyx-handler: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
