import assert from "node:assert/strict";
import { buildInstantMctbInboundTexml } from "../src/lib/mctb/texml-ingress/inbound-texml";
import { MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_PRESS_1 } from "../src/lib/mctb/consent-mode";

const baseProfile = {
  consentMode: MCTB_CONSENT_MODE_PRESS_1,
  automationActive: true,
  e164: "+18665550100",
  greetingToken: "greet-token",
  routingToken: "route-token",
  press1PlayUrl: "https://example.com/press1.mp3",
};

const fields = { To: "+18665550100" };

const activePress1 = buildInstantMctbInboundTexml({
  profile: baseProfile,
  fields,
  certMode: "D",
  publicBaseUrl: "https://app.example.com",
});
assert.ok(activePress1);
assert.equal(activePress1?.branch, "press_1_gather");
assert.ok(activePress1?.body.includes("Gather") || activePress1?.body.includes("gather"));

const pausedPress1 = buildInstantMctbInboundTexml({
  profile: { ...baseProfile, automationActive: false },
  fields,
  certMode: "D",
  publicBaseUrl: "https://app.example.com",
});
assert.ok(pausedPress1);
assert.equal(pausedPress1?.branch, "paused_voicemail");
assert.ok(pausedPress1?.voicemailPlayUrl || pausedPress1?.body.includes("Record"));

const existingConsent = buildInstantMctbInboundTexml({
  profile: {
    ...baseProfile,
    consentMode: MCTB_CONSENT_MODE_EXISTING,
    automationActive: true,
  },
  fields,
  certMode: "D",
  publicBaseUrl: "https://app.example.com",
});
assert.ok(existingConsent);
assert.equal(existingConsent?.branch, "existing_consent");

console.log("MCTB_PAUSED_CALL_FALLBACK: PASS");
