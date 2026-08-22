/**
 * Smoke test for platform 571 MCTB TeXML consent route helpers.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-consent-texml-route.ts
 */
import assert from "node:assert/strict";
import { parseTelnyxForwardedFrom } from "../src/lib/voice/telnyx/forwarded-from";
import { MCTB_PLATFORM_DEMO_E164 } from "../src/lib/mctb/onboarding/constants";
import {
  isPlatform571E164,
  mctb571ConsentPlaybackUrl,
  mctb571ConsentTexmlVoiceUrl,
} from "../src/lib/mctb/consent-prompt/telnyx-texml-route";

const sampleForwarder = process.env.MCTB_TEST_FORWARDED_FROM || "+15555550100";
assert.equal(isPlatform571E164(MCTB_PLATFORM_DEMO_E164), true);
assert.equal(isPlatform571E164(sampleForwarder), false);

const voiceUrl = mctb571ConsentTexmlVoiceUrl();
assert.match(voiceUrl, /\/api\/telnyx\/voice\/mctb-consent$/);

const playbackUrl = mctb571ConsentPlaybackUrl();
assert.match(playbackUrl, /\/api\/public\/smart-routing-audio\//);

const actionUrl = new URL(voiceUrl);
actionUrl.searchParams.set("event", "gather");
actionUrl.searchParams.set("forwardedFrom", sampleForwarder);
assert.equal(actionUrl.searchParams.get("forwardedFrom"), sampleForwarder);

assert.equal(
  parseTelnyxForwardedFrom({
    sip_headers: [{ name: "Diversion", value: "<sip:+15555550100@example.com>;reason=unconditional" }],
  }),
  "+15555550100",
);

console.log("test-mctb-consent-texml-route: ok");
