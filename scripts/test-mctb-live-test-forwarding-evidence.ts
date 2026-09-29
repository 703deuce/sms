/**
 * Live test must require CFNA evidence when a business line is configured.
 */
import assert from "node:assert/strict";
import { mctbSameE164 } from "../src/lib/mctb/phone/e164-match";
import { buildOnboardingLiveTestSteps } from "../src/lib/mctb/onboarding/live-test-presentation";

assert.equal(mctbSameE164("+15715550188", "5715550188"), true);
assert.equal(mctbSameE164("+18885550100", "+15715550188"), false);

const pending = buildOnboardingLiveTestSteps({
  consentMode: "press_1",
  checks: {
    callDetected: true,
    forwardingVerified: false,
    missedCall: false,
    consentCompleted: false,
    textSent: false,
    textDelivered: false,
    replyReceived: false,
  },
});
assert.equal(pending.every((s) => !s.done), true);

const complete = buildOnboardingLiveTestSteps({
  consentMode: "existing_consent",
  checks: {
    callDetected: true,
    forwardingVerified: true,
    missedCall: true,
    consentCompleted: true,
    textSent: true,
    textDelivered: true,
    replyReceived: true,
  },
});
assert.equal(complete.every((s) => s.done), true);

console.log("test-mctb-live-test-forwarding-evidence: PASS");
