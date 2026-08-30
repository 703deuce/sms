/**
 * Contract: Press-1 uses platform-standard audio; voicemail uses custom or platform default.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-press1-playback-fallback.ts
 */
import assert from "node:assert/strict";
import { buildMctbConsentInboundTexml } from "../src/lib/mctb/consent-prompt/texml-response";
import { isConsentAudioAssetReachable } from "../src/lib/mctb/consent-prompt/audio-reachability";
import {
  getMctbConsentAudioAssetId,
  getMctbConsentPlaybackUrl,
} from "../src/lib/mctb/consent-prompt/texml-response";
import { MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID } from "../src/lib/mctb/texml-ingress/frozen-pipeline";
import { resolveMctbPress1TexmlPlayback } from "../src/lib/mctb/texml-ingress/press1-playback";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`✓ ${name}`),
    (err) => {
      console.error(`✗ ${name}`);
      throw err;
    },
  );
}

async function main() {
  await test("platform press-1 consent audio is bundled and reachable", async () => {
    const reachable = await isConsentAudioAssetReachable(getMctbConsentAudioAssetId());
    assert.equal(reachable, true);
  });

  await test("platform default voicemail greeting is bundled and reachable", async () => {
    const reachable = await isConsentAudioAssetReachable(
      MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
    );
    assert.equal(reachable, true);
  });

  await test("production press-1 always uses platform standard clip", async () => {
    const playback = await resolveMctbPress1TexmlPlayback({ workspaceId: "ws_1" });
    assert.equal(playback.failClosed, false);
    assert.equal(playback.playUrl, getMctbConsentPlaybackUrl());
    assert.equal(playback.sayText, null);
  });

  await test("TeXML uses Say when only sayText is provided (play-gather)", () => {
    const built = buildMctbConsentInboundTexml("+15555550100", {
      promptMode: "play-gather",
      press1PlayUrl: null,
      press1SayText: "Sorry we missed your call. To receive a text message from us, press 1 now.",
    });
    assert.match(built.body, /<Say voice="female">/);
    assert.doesNotMatch(built.body, /<Play>/);
    assert.match(built.body, /<Gather[^>]*numDigits="1"/);
  });

  console.log("\nAll MCTB platform audio tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
