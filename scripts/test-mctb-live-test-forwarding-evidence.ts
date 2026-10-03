/**
 * Live test must require CFNA evidence when a business line is configured.
 */
import assert from "node:assert/strict";
import { mctbSameE164 } from "../src/lib/mctb/phone/e164-match";
import {
  evaluateMctbLiveTestForwardingVerified,
  isMctbLiveTestCallBusinessE164,
} from "../src/lib/mctb/onboarding/live-test-forwarding";
import { buildOnboardingLiveTestSteps } from "../src/lib/mctb/onboarding/live-test-presentation";

assert.equal(
  evaluateMctbLiveTestForwardingVerified({
    businessE164: "+15714776175",
    forwardedFrom: null,
    forwardTargetE164: "+18884580119",
    businessLineE164: "5714776175",
    allowIngressWithoutForwardHeader: true,
  }),
  true,
  "business-line leg without ForwardedFrom must verify during onboarding",
);

assert.equal(
  evaluateMctbLiveTestForwardingVerified({
    businessE164: "+18884580119",
    forwardedFrom: "+15714776175",
    forwardTargetE164: "+18884580119",
    businessLineE164: "5714776175",
    allowIngressWithoutForwardHeader: true,
  }),
  true,
  "ingress leg with ForwardedFrom must verify",
);

assert.equal(
  isMctbLiveTestCallBusinessE164({
    businessE164: "+15714776175",
    forwardTargetE164: "+18884580119",
    businessLineE164: "5714776175",
  }),
  true,
  "business-line E.164 must count as live-test call target",
);

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
