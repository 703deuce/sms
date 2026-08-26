/**
 * Platform default voicemail greeting playback.
 * Run: npx tsx scripts/test-voicemail-greeting-default.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
  resolvePlatformVoicemailGreetingAssetId,
  resolvePlatformVoicemailGreetingPlayUrl,
} from "../src/lib/phone/voicemail-greeting-defaults";

process.env.APP_URL = "https://voice.transovo.ai";

assert.equal(resolvePlatformVoicemailGreetingAssetId(), DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID);
assert.match(
  resolvePlatformVoicemailGreetingPlayUrl(),
  new RegExp(`/api/public/smart-routing-audio/${DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID}$`),
);

console.log("test-voicemail-greeting-default: ok");
