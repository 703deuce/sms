/**
 * Carrier forwarding capability + timing policy checks.
 * Run: npx tsx scripts/test-mctb-carrier-forwarding.ts
 */
import assert from "node:assert/strict";
import {
  getCarrierCapabilities,
  isForwardRingTimingSafe,
  DEFAULT_FORWARD_RING_SECONDS,
} from "../src/lib/mctb/onboarding/carrier-capabilities";
import { getCarrierGuide } from "../src/lib/mctb/onboarding/carriers";

const att = getCarrierCapabilities("att");
assert.equal(att.voicemailRaceRisk, "high");
assert.equal(att.alternateSetupRequired, true);
assert.equal(att.supportsNoAnswerTimer, false);
assert.ok(att.unverifiedFeatureCodes?.includes("*610"));

assert.equal(isForwardRingTimingSafe({ forwardRingSeconds: 15, voicemailPickupSeconds: 22 }), true);
assert.equal(isForwardRingTimingSafe({ forwardRingSeconds: 25, voicemailPickupSeconds: 22 }), false);

const attGuide = getCarrierGuide("att");
assert.ok(attGuide.steps.some((s) => s.includes("voicemail")));
assert.ok(attGuide.capabilities.alternateSetupNote?.includes("Live cert"));

assert.equal(DEFAULT_FORWARD_RING_SECONDS, 15);

console.log("test-mctb-carrier-forwarding: ok");
