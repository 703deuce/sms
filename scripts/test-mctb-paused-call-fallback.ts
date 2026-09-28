import assert from "node:assert/strict";
import { buildInstantMctbInboundTexml } from "../src/lib/mctb/texml-ingress/inbound-texml";
import { MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_PRESS_1 } from "../src/lib/mctb/consent-mode";

const baseFields = { To: "+18665550100" };

function profile(overrides: Partial<{
  consentMode: string;
  automationActive: boolean;
}>) {
  return {
    consentMode: MCTB_CONSENT_MODE_PRESS_1,
    automationActive: true,
    e164: "+18665550100",
    greetingToken: "greet-token",
    routingToken: "route-token",
    press1PlayUrl: "https://example.com/press1.mp3",
    ...overrides,
  };
}

function build(overrides: Partial<ReturnType<typeof profile>>) {
  return buildInstantMctbInboundTexml({
    profile: profile(overrides),
    fields: baseFields,
    certMode: "D",
    publicBaseUrl: "https://app.example.com",
  });
}

const activePress1 = build({ consentMode: MCTB_CONSENT_MODE_PRESS_1, automationActive: true });
assert.ok(activePress1);
assert.equal(activePress1?.branch, "press_1_gather");

const pausedPress1 = build({ consentMode: MCTB_CONSENT_MODE_PRESS_1, automationActive: false });
assert.ok(pausedPress1);
assert.equal(pausedPress1?.branch, "paused_voicemail");
assert.ok(pausedPress1?.voicemailPlayUrl || pausedPress1?.body.includes("Record"));

const resumedPress1 = build({ consentMode: MCTB_CONSENT_MODE_PRESS_1, automationActive: true });
assert.equal(resumedPress1?.branch, "press_1_gather");

const existingActive = build({
  consentMode: MCTB_CONSENT_MODE_EXISTING,
  automationActive: true,
});
assert.ok(existingActive);
assert.equal(existingActive?.branch, "existing_consent");

const existingPaused = build({
  consentMode: MCTB_CONSENT_MODE_EXISTING,
  automationActive: false,
});
assert.ok(existingPaused);
assert.equal(existingPaused?.branch, "existing_consent");

console.log("MCTB_PAUSED_CALL_FALLBACK matrix: PASS");
