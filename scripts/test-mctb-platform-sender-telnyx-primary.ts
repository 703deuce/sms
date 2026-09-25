/**
 * Telnyx-primary platform sender — adoption merge, route gate, Twilio preservation.
 * Run: npx tsx scripts/test-mctb-platform-sender-telnyx-primary.ts
 */
import assert from "node:assert/strict";
import { isMctbPlatformParentTwilioSendEligible } from "@/lib/mctb/messaging/platform-parent-twilio-send";
import {
  mergePlatformMctbSenderSettings,
  demoteTwilioPlatformMctbSenderToPreserved,
  adoptMctbPlatformSenderFromTelnyxAccount,
} from "@/lib/mctb/messaging/platform-sender-adopt";
import {
  isPlatformMctbSenderPhoneRecord,
  isPreservedTwilioPlatformMctbSenderRecord,
  platformMctbSenderSettings,
  telnyxLocalA2pSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

const TELNYX_E164 = "+18666020680";
const TWILIO_E164 = "+18885046264";

// Dual-role: voice ingress + platform SMS on same Telnyx DID
{
  const merged = mergePlatformMctbSenderSettings(
    telnyxLocalA2pSettings({ role: "customer_mctb", a2pApproved: true }),
    platformMctbSenderSettings({ provider: "telnyx", tfvApproved: true, dualVoiceIngress: true }),
  );
  assert.equal(merged.mctbRole, "customer_mctb");
  assert.equal(merged.platformMctbSender, true);
  assert.equal(isPlatformMctbSenderPhoneRecord({ settingsJson: merged }), true);
}

// Platform adopt must not leave stale NOT_STARTED compliance on an existing ingress row
{
  const merged = mergePlatformMctbSenderSettings(
    {
      messagingCompliance: { type: "A2P_10DLC", status: "NOT_STARTED" },
      mctbNumberClass: "TELNYX_LOCAL_A2P",
      mctbRole: "customer_mctb",
    },
    platformMctbSenderSettings({ provider: "telnyx", tfvApproved: true, dualVoiceIngress: true }),
  );
  const compliance = merged.messagingCompliance as { status?: string };
  assert.equal(compliance.status, "APPROVED");
}

// Dedicated platform_mctb_sender row shape (Twilio preserved alternate)
assert.equal(
  isPlatformMctbSenderPhoneRecord({
    settingsJson: platformMctbSenderSettings({ provider: "twilio" }),
  }),
  true,
);

// Preserved Twilio is not canonical platform sender
const preservedSettings = {
  ...platformMctbSenderSettings({ provider: "twilio" }),
  mctbRole: "customer_production",
  platformMctbSender: false,
  platformMctbSenderPreservedTwilio: true,
};
assert.equal(isPlatformMctbSenderPhoneRecord({ settingsJson: preservedSettings }), false);
assert.equal(isPreservedTwilioPlatformMctbSenderRecord({ settingsJson: preservedSettings }), true);

// Telnyx canonical → parent Twilio send must not engage
const telnyxCanonical: CanonicalMctbPlatformSender = {
  phoneNumberId: "pn_telnyx_platform",
  e164: TELNYX_E164,
  workspaceId: "ws_owner",
  provider: "telnyx",
};
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_telnyx_platform",
    canonical: telnyxCanonical,
    phoneHasPlatformSenderRole: true,
    outboundSmsAuthorized: true,
  }),
  false,
);

// Twilio preserved row can still be represented for reactivation (provider twilio)
const twilioCanonical: CanonicalMctbPlatformSender = {
  phoneNumberId: "pn_twilio_preserved",
  e164: TWILIO_E164,
  workspaceId: "ws_owner",
  provider: "twilio",
};
assert.equal(
  isMctbPlatformParentTwilioSendEligible({
    authorizedPhoneNumberId: "pn_twilio_preserved",
    canonical: twilioCanonical,
    phoneHasPlatformSenderRole: true,
    outboundSmsAuthorized: true,
  }),
  true,
);

// Import surface — adoption helpers exist (runtime exercised in switch script / production)
assert.equal(typeof adoptMctbPlatformSenderFromTelnyxAccount, "function");
assert.equal(typeof demoteTwilioPlatformMctbSenderToPreserved, "function");

console.log("test:mctb-platform-sender-telnyx-primary ok");
