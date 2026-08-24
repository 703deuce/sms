/**
 * Business callback RingOut-style flow contracts.
 * Run: npx tsx scripts/test-business-callback-ringout.ts
 */
import assert from "node:assert/strict";
import {
  mapOutboundResultToUiStatus,
  businessCallbackStatusLabel,
  resolveAuthorizedCallerCallbackPhone,
  formatCallbackPromptDestination,
} from "../src/lib/smart-routing/business-callback-status";
import { buildSmartRoutingNavChildren } from "../src/lib/smart-routing/nav-children";

assert.equal(
  resolveAuthorizedCallerCallbackPhone({
    phoneE164: "+15715551234",
    preferredCallbackPhoneE164: "+17035559999",
  }),
  "+17035559999",
);
assert.equal(
  resolveAuthorizedCallerCallbackPhone({ phoneE164: "+15715551234" }),
  "+15715551234",
);

assert.equal(mapOutboundResultToUiStatus("awaiting_confirmation"), "awaiting_confirmation");
assert.equal(mapOutboundResultToUiStatus("customer_ringing"), "calling_customer");
assert.equal(
  businessCallbackStatusLabel("awaiting_confirmation"),
  "Waiting for you to press 1…",
);

const prompt = formatCallbackPromptDestination("+17035551234", "John Smith");
assert.ok(prompt.includes("John Smith"));

const srNav = buildSmartRoutingNavChildren();
assert.ok(srNav.some((i) => i.label === "Business Call Back"));

console.log("test-business-callback-ringout: ok");
