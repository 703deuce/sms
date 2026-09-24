/**
 * Model B parent Twilio send gate + bootstrap invariants.
 * Run: npx tsx scripts/test-mctb-platform-parent-twilio-gate.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMctbPlatformParentTwilioSendEligible } from "@/lib/mctb/messaging/platform-parent-twilio-send";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

const canonical: CanonicalMctbPlatformSender = {
  phoneNumberId: "pn_platform",
  e164: "+18885046264",
  workspaceId: "ws_owner",
  provider: "twilio",
};

// PLATFORM + canonical + role + authorized → eligible
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_platform",
    canonical,
    phoneHasPlatformSenderRole: true,
    outboundSmsAuthorized: true,
  }),
  true,
);

// Non-canonical Twilio phone → not eligible (no parent fallback)
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_customer_twilio",
    canonical,
    phoneHasPlatformSenderRole: true,
    outboundSmsAuthorized: true,
  }),
  false,
);

// WORKSPACE-style: missing subaccount path would pass wrong id → not eligible
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_workspace_no_sub",
    canonical,
    phoneHasPlatformSenderRole: false,
    outboundSmsAuthorized: false,
  }),
  false,
);

// Missing role on canonical id → not eligible
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_platform",
    canonical,
    phoneHasPlatformSenderRole: false,
    outboundSmsAuthorized: true,
  }),
  false,
);

// Telnyx canonical platform sender → not eligible for Twilio parent client
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_platform",
    canonical: { ...canonical, provider: "telnyx" },
    phoneHasPlatformSenderRole: true,
    outboundSmsAuthorized: true,
  }),
  false,
);

// Setup script must not read MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID as a prerequisite
const setupSource = readFileSync("scripts/setup-mctb-platform-sender.ts", "utf8");
assert.equal(
  /process\.env\.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID/.test(setupSource),
  false,
);
assert.match(setupSource, /adoptMctbPlatformSenderFromParentAccount/);
assert.match(setupSource, /requireMctbPlatformOwnerWorkspaceId/);

console.log("test:mctb-platform-parent-twilio-gate ok");
