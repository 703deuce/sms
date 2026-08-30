/**
 * Contract: Press-1 playback never returns a 404 platform Play URL — Say fallback instead.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-press1-playback-fallback.ts
 */
import assert from "node:assert/strict";
import { buildMctbConsentInboundTexml } from "../src/lib/mctb/consent-prompt/texml-response";
import { isConsentAudioAssetReachable } from "../src/lib/mctb/consent-prompt/audio-reachability";
import { getMctbConsentAudioAssetId } from "../src/lib/mctb/consent-prompt/texml-response";
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
  await test("platform default consent asset is missing in this environment", async () => {
    const reachable = await isConsentAudioAssetReachable(getMctbConsentAudioAssetId());
    assert.equal(reachable, false, "expected missing platform asset for fallback test");
  });

  await test("ws_1 playback does not return unreachable platform Play URL", async () => {
    const playback = await resolveMctbPress1TexmlPlayback({ workspaceId: "ws_1" });
    assert.equal(playback.failClosed, false);
    if (playback.playUrl) {
      const reachable = await isConsentAudioAssetReachable(
        playback.playUrl.split("/").pop() || "",
      );
      assert.equal(reachable, true, `playUrl must be reachable: ${playback.playUrl}`);
    } else {
      assert.ok(playback.sayText?.trim(), "must have sayText when no playUrl");
    }
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

  console.log("\nAll press-1 playback fallback tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
