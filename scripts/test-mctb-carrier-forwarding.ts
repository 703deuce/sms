/**
 * Carrier forwarding capability + timing policy checks.
 * Run: npx tsx scripts/test-mctb-carrier-forwarding.ts
 */
import assert from "node:assert/strict";
import {
  formatAttNoAnswerForwardDialCode,
  getCarrierCapabilities,
  isForwardRingTimingSafe,
  DEFAULT_FORWARD_RING_SECONDS,
} from "../src/lib/mctb/onboarding/carrier-capabilities";
import { formatCarrierStep, getCarrierGuide } from "../src/lib/mctb/onboarding/carriers";

const att = getCarrierCapabilities("att");
assert.equal(att.voicemailRaceRisk, "medium");
assert.equal(att.alternateSetupRequired, false);
assert.equal(att.supportsNoAnswerTimer, true);
assert.equal(att.setupMethod, "carrier_codes");
assert.ok(att.unverifiedFeatureCodes?.includes("*610"));
assert.ok(att.verifiedNoAnswerForwardDialCode?.includes("*61*"));

assert.equal(
  formatAttNoAnswerForwardDialCode({
    forwardToE164: "+18553103375",
    delaySeconds: 10,
  }),
  "*61*18553103375*11*10#",
);

assert.equal(isForwardRingTimingSafe({ forwardRingSeconds: 15, voicemailPickupSeconds: 22 }), true);
assert.equal(isForwardRingTimingSafe({ forwardRingSeconds: 25, voicemailPickupSeconds: 22 }), false);

const attGuide = getCarrierGuide("att");
assert.ok(attGuide.steps.some((s) => s.includes("YOUR_ATT_NO_ANSWER_CODE")));
assert.ok(attGuide.capabilities.liveVerifiedNote?.includes("Pass 2 cert"));

const formatted = formatCarrierStep(attGuide.steps[0]!, {
  transovoE164: "+18553103375",
  forwardRingSeconds: 10,
});
assert.ok(formatted.includes("*61*18553103375*11*10#"));
assert.ok(!formatted.includes("YOUR_ATT_NO_ANSWER_CODE"));

assert.equal(DEFAULT_FORWARD_RING_SECONDS, 15);

console.log("test-mctb-carrier-forwarding: ok");
