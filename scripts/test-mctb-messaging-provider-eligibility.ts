/**
 * Provider-aware MCTB SMS routing + compliance regime tests.
 * Run: npx tsx scripts/test-mctb-messaging-provider-eligibility.ts
 */
import assert from "node:assert/strict";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
  telnyxLocalA2pSettings,
  tollFreeComplianceSettings,
} from "../src/lib/messaging/compliance/phone-number-class";
import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_PLATFORM_DEMO_DISPLAY,
} from "../src/lib/mctb/onboarding/constants";

assert.equal(
  classifyProductionNumber({
    e164: "+18553103375",
    provider: "twilio",
    type: "TollFree",
    settingsJson: tollFreeComplianceSettings(),
  }),
  "TWILIO_TOLL_FREE",
);

assert.equal(
  classifyProductionNumber({
    e164: MCTB_PLATFORM_DEMO_E164,
    provider: "telnyx",
    type: "Local",
    settingsJson: telnyxLocalA2pSettings({ role: "platform_demo", a2pApproved: true }),
  }),
  "TELNYX_LOCAL_A2P",
);

assert.equal(
  isPlatformDemoPhoneRecord({
    e164: MCTB_PLATFORM_DEMO_E164,
    settingsJson: telnyxLocalA2pSettings({ role: "platform_demo" }),
  }),
  true,
);

assert.equal(
  isPlatformDemoPhoneRecord({
    e164: "+18553103375",
    settingsJson: tollFreeComplianceSettings(),
  }),
  false,
);

assert.equal(MCTB_PLATFORM_DEMO_E164, "+15714073615");
assert.equal(MCTB_PLATFORM_DEMO_DISPLAY, "1-571-407-3615");

console.log("test-mctb-messaging-provider-eligibility: ok");
