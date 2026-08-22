/**
 * Fixture tests for MCTB Call Control diagnostic handler (no live Telnyx API).
 * Uses mock_ call_control_id prefix so telnyx-provider skips HTTP.
 *
 * Run: npx tsx scripts/test-mctb-call-control-handler.ts
 */
import assert from "node:assert/strict";
import {
  handleMctbCallControlDiagnosticEvent,
  resetMctbCallControlDiagnosticStateForTests,
} from "../src/lib/mctb/consent-prompt/call-control-diagnostic";
import { MCTB_PLATFORM_DEMO_E164 } from "../src/lib/mctb/onboarding/constants";

const CALL_ID = "mock_v3:test-call-control-diagnostic";

const basePayload = {
  call_control_id: CALL_ID,
  call_session_id: "sess-test-001",
  call_leg_id: "leg-test-001",
  from: "+1test-caller-0001",
  // pragma: allowlist secret
  to: MCTB_PLATFORM_DEMO_E164,
  direction: "incoming",
  sip_headers: [
    {
      name: "Diversion",
      // pragma: allowlist secret
      value: "<sip:+1test-forward-0001@example.com>;reason=unconditional",
    },
  ],
};

async function main() {
  resetMctbCallControlDiagnosticStateForTests();

  const initiated = await handleMctbCallControlDiagnosticEvent({
    eventType: "call.initiated",
    eventPayload: basePayload,
  });
  assert.equal(initiated.handled, true);
  assert.equal(initiated.action, "answer");

  const answered = await handleMctbCallControlDiagnosticEvent({
    eventType: "call.answered",
    eventPayload: basePayload,
  });
  assert.equal(answered.handled, true);
  assert.equal(answered.action, "speak");

  const speakEnded = await handleMctbCallControlDiagnosticEvent({
    eventType: "call.speak.ended",
    eventPayload: basePayload,
  });
  assert.equal(speakEnded.handled, true);
  assert.equal(speakEnded.action, "hangup");

  // Duplicate events should not throw (idempotent)
  await handleMctbCallControlDiagnosticEvent({
    eventType: "call.initiated",
    eventPayload: basePayload,
  });
  await handleMctbCallControlDiagnosticEvent({
    eventType: "call.answered",
    eventPayload: basePayload,
  });
  await handleMctbCallControlDiagnosticEvent({
    eventType: "call.speak.ended",
    eventPayload: basePayload,
  });

  const hangup = await handleMctbCallControlDiagnosticEvent({
    eventType: "call.hangup",
    eventPayload: { ...basePayload, hangup_cause: "normal_clearing" },
  });
  assert.equal(hangup.handled, true);

  const wrongTo = await handleMctbCallControlDiagnosticEvent({
    eventType: "call.initiated",
    eventPayload: { ...basePayload, to: "+15551234567" },
  });
  assert.equal(wrongTo.handled, false);

  console.log("test-mctb-call-control-handler: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
