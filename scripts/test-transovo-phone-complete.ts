/**
 * Transovo phone platform tests — callback, hold music, nav.
 * Run: npx tsx scripts/test-transovo-phone-complete.ts
 */
import assert from "node:assert/strict";
import {
  mapOutboundResultToUiStatus,
  businessCallbackStatusLabel,
  resolveAuthorizedCallerCallbackPhone,
} from "../src/lib/smart-routing/business-callback-status";
import {
  HOLD_MUSIC_TRACKS,
  DEFAULT_HOLD_MUSIC_SLUG,
  getHoldMusicTrack,
} from "../src/lib/smart-routing/hold-music-library";
import { buildSmartRoutingNavChildren } from "../src/lib/smart-routing/nav-children";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { isVoiceProductPath } from "../src/lib/products/voice-routes";
import {
  mapContextTypeFromSource,
  type InitiateBusinessCallbackInput,
} from "../src/lib/smart-routing/business-callback-types";
import { isDestinationAvailable } from "../src/lib/smart-routing/destination-availability";
import { isDomesticCallbackDestination, isBlockedCallbackDestination } from "../src/lib/smart-routing/callback-destination-policy";

assert.equal(resolveAuthorizedCallerCallbackPhone({
  phoneE164: "+15715551234",
  preferredCallbackPhoneE164: "+17035559999",
}), "+17035559999");

assert.equal(mapOutboundResultToUiStatus("awaiting_confirmation"), "awaiting_confirmation");
assert.equal(businessCallbackStatusLabel("awaiting_confirmation"), "Waiting for you to press 1…");

assert.equal(HOLD_MUSIC_TRACKS.length, 10);
assert.equal(getHoldMusicTrack(DEFAULT_HOLD_MUSIC_SLUG)?.title, "Modern Corporate");

const srNav = buildSmartRoutingNavChildren();
assert.ok(srNav.some((i) => i.label === "Business Call Back"));
assert.ok(!srNav.some((i) => i.label === "Analytics"));

const voiceNav = buildVoiceNav({
  productFeatures: {
    mctb: "active",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
});
assert.ok(voiceNav.some((i) => i.href === "/inbox"));
assert.ok(voiceNav.some((i) => i.href === "/voice/analytics"));
assert.ok(!voiceNav.some((i) => i.href === "/integrations"));

assert.equal(isVoiceProductPath("/inbox"), true);

const input: InitiateBusinessCallbackInput = {
  workspaceId: "w1",
  authorizedCallerId: "a1",
  destinationE164: "+17035551234",
  sourceType: "routing_activity",
  initiationMethod: "employee_link",
};
assert.equal(mapContextTypeFromSource(input.sourceType), "activity");

assert.equal(isDestinationAvailable({ active: true, onBusinessCall: true }), false);
assert.equal(isDestinationAvailable({ active: true, onBusinessCall: false }), true);
assert.equal(isBlockedCallbackDestination("+15551234567", { routingNumberE164: "+15559999999" }), false);
assert.equal(isDomesticCallbackDestination("+17035551234"), true);

console.log("test-transovo-phone-complete: ok");
