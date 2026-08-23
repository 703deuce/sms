/**
 * Smart Routing dual-number architecture contracts.
 * Run: npx tsx scripts/test-smart-routing-dual-numbers.ts
 */
import assert from "node:assert/strict";
import {
  isBlockedCallbackDestination,
  isDomesticCallbackDestination,
} from "../src/lib/smart-routing/callback-destination-policy";
import { isWorkspaceInternalSmartRoutingNumberSync } from "../src/lib/smart-routing/internal-numbers";

const settings = {
  routingNumberE164: "+17035559000",
  callbackNumberE164: "+17035559001",
};

assert.equal(
  isWorkspaceInternalSmartRoutingNumberSync(settings, "+17035559000"),
  true,
);
assert.equal(
  isWorkspaceInternalSmartRoutingNumberSync(settings, "+17035559001"),
  true,
);
assert.equal(
  isWorkspaceInternalSmartRoutingNumberSync(settings, "+17035551234"),
  false,
);

assert.equal(
  isBlockedCallbackDestination("+17035559000", {
    routingNumberE164: settings.routingNumberE164,
    callbackNumberE164: settings.callbackNumberE164,
  }),
  true,
);
assert.equal(
  isBlockedCallbackDestination("+17035559001", {
    routingNumberE164: settings.routingNumberE164,
    callbackNumberE164: settings.callbackNumberE164,
  }),
  true,
);
assert.equal(
  isBlockedCallbackDestination("+17035551234", {
    routingNumberE164: settings.routingNumberE164,
    callbackNumberE164: settings.callbackNumberE164,
  }),
  false,
);

assert.equal(isDomesticCallbackDestination("+17035551234"), true);

console.log("test-smart-routing-dual-numbers: ok");
