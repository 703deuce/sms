/**
 * Hermetic checks for Twilio Smart Routing runtime helpers.
 * Run: npx tsx scripts/test-smart-routing-twilio-runtime.ts
 */
import assert from "node:assert/strict";
import { resolvePhoneNumberProvider } from "../src/lib/numbers/providers/normalize";
import { isPersonalNumberParked } from "../src/lib/numbers/personal-call-settings";
import { resolveNumberInboundRoute } from "../src/lib/numbers/inbound-number-routing";

assert.equal(
  resolvePhoneNumberProvider({ provider: "twilio", twilioSid: "PN123", providerNumberId: "PN123" }),
  "twilio",
);

const smartRoutingRow = {
  id: "pn1",
  workspaceId: "ws1",
  e164: "+15551110001",
  voiceForwardTo: null,
  provider: "twilio",
  twilioSid: "PN123",
  providerNumberId: "PN123",
  settingsJson: {
    parked: false,
    routingOwner: "smart_routing",
    forwardingEnabled: true,
    forwardTargets: ["+15552220000"],
  },
} as const;

assert.equal(resolveNumberInboundRoute(smartRoutingRow).kind, "default");

assert.equal(
  isPersonalNumberParked({
    settingsJson: { parked: false, personalServiceState: "PARKED" },
  }),
  false,
);

console.log("test-smart-routing-twilio-runtime: ok");
