/**
 * MCTB consent publish uses assigned Setup number (not toll-free only).
 *
 *   npx tsx scripts/test-mctb-consent-publish-assigned-number.ts
 */
import assert from "node:assert/strict";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";

const platformDemoSettings = {
  mctbRole: "platform_demo",
  mctbSipIngress: true,
  messagingCompliance: { type: "A2P_10DLC", status: "NOT_STARTED" },
};

assert.equal(
  isPhoneMessagingApproved({
    settingsJson: platformDemoSettings,
    a2pStatus: "APPROVED",
    type: "local",
  }),
  true,
);

const customerLocal = telnyxLocalA2pSettings({ role: "customer_production", a2pApproved: true });
assert.equal(isPhoneMctbSipIngress(customerLocal), true);

console.log("✓ test:mctb-platform-demo-a2p-approved");
console.log("✓ test:mctb-sip-ingress-customer-local");
console.log("\nConsent publish assigned-number tests passed.");
