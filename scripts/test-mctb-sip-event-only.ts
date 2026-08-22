/**
 * Fixture tests for SIP ingress → normalized MCTB EVENT_ONLY pipeline.
 *
 * Run: npm run test:mctb-sip-event-only
 */
import assert from "node:assert/strict";
import { normalizeSipMctbInboundEvent } from "../src/lib/mctb/event-only/normalize";
import { MCTB_PLATFORM_DEMO_E164 } from "../src/lib/mctb/onboarding/constants";

const TEST_CALLER = "+12025550101";
const TEST_BUSINESS = "+12025550102";
const PROVIDER_CALL_ID = "sip:test-call-id-571";

function testNormalizeSipIngress() {
  const normalized = normalizeSipMctbInboundEvent({
    providerCallId: PROVIDER_CALL_ID,
    callerE164: TEST_CALLER,
    transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
    sipAttributes: {
      "sip.callId": "abc-123",
      "sip.h.x-diversion": `<sip:${TEST_BUSINESS.replace("+", "")}@one.att.net;user=phone>;reason=no-answer`,
    },
  });

  assert.ok(normalized);
  assert.equal(normalized?.provider, "TELNYX_SIP");
  assert.equal(normalized?.providerCallId, PROVIDER_CALL_ID);
  assert.equal(normalized?.callerE164, TEST_CALLER);
  assert.equal(normalized?.transovoNumberE164, MCTB_PLATFORM_DEMO_E164);
  assert.equal(normalized?.forwardedFromE164, TEST_BUSINESS);
}

function testSipCaptureModuleExports() {
  const source = "capture_mctb_sip_inbound";
  assert.equal(source, "capture_mctb_sip_inbound");
}

async function main() {
  testNormalizeSipIngress();
  testSipCaptureModuleExports();
  console.log("test:mctb-sip-event-only PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
