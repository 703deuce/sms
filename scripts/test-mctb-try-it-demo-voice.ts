/**
 * Try It demo voice — ElevenLabs pre-recorded assets (no Telnyx TTS).
 *
 *   npx tsx scripts/test-mctb-try-it-demo-voice.ts
 */
import assert from "node:assert/strict";
import {
  TRY_IT_VM_GREETING_TEXT,
} from "@/lib/mctb/try-it/demo-voice";
import { applyConsentPlaybackFailClosed } from "@/lib/mctb/consent-prompt/playback-policy";

assert.ok(TRY_IT_VM_GREETING_TEXT.length > 20);

const failClosed = applyConsentPlaybackFailClosed(
  { audioAssetId: "asset_1", promptScriptHash: "abc" },
  { sayText: "Telnyx TTS fallback" },
);
assert.equal(failClosed.failClosed, true);
assert.equal(failClosed.playUrl, undefined);

const okPlayback = applyConsentPlaybackFailClosed(
  { audioAssetId: "asset_1" },
  { playUrl: "https://example.com/audio.mp3" },
);
assert.equal(okPlayback.playUrl, "https://example.com/audio.mp3");

console.log("✓ test:try-it-demo-voice-no-telnyx-tts-fallback");
console.log("\nTry It demo voice policy tests passed.");
