import assert from "node:assert/strict";
import {
  buildDialCodeCopyText,
  clampRingSeconds,
  connectionStatusLabel,
  isPlausibleUsPhoneInput,
  normalizeBusinessLineInput,
  resolveConnectionUiStatus,
  shouldShowVoicemailTimingWarning,
  snapshotsEqual,
} from "../src/lib/mctb/setup-phone-forwarding-model";
import { getCarrierGuide } from "../src/lib/mctb/onboarding/carriers";

assert.equal(normalizeBusinessLineInput("(540) 555-1234"), "+15405551234");
assert.equal(isPlausibleUsPhoneInput("5405551234"), true);
assert.equal(isPlausibleUsPhoneInput("12"), false);

assert.equal(resolveConnectionUiStatus({ testStarted: true, callDetected: true, verified: true, detectedAt: null }, true, true), "verified");
assert.equal(resolveConnectionUiStatus(null, true, true), "pending");
assert.equal(resolveConnectionUiStatus(null, false, true), "unknown");
assert.equal(connectionStatusLabel("verified"), "Verified");

assert.equal(clampRingSeconds(5), 10);
assert.equal(clampRingSeconds(99), 30);

assert.equal(shouldShowVoicemailTimingWarning("verizon", 25), true);
assert.equal(shouldShowVoicemailTimingWarning("verizon", 15), false);

const attGuide = getCarrierGuide("att");
const dial = buildDialCodeCopyText(attGuide, "+18885550199", 10);
assert.ok(dial?.includes("*61*"));

const a = { phoneNumberId: "p1", businessLineE164: "+1", carrier: "verizon" as const, forwardRingSeconds: 15 };
const b = { ...a };
assert.equal(snapshotsEqual(a, b), true);
b.forwardRingSeconds = 20;
assert.equal(snapshotsEqual(a, b), false);

console.log("test-mctb-setup-phone-forwarding: ok");
