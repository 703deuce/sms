/**
 * Contract: mctb-entry cert=D returns TeXML without awaiting DB (routing profile / fail-open).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-inbound-instant-texml.ts
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  buildFailOpenInboundRoutingProfile,
  platformPress1PlayUrl,
  warmMctbInboundRoutingProfileForE164,
} from "../src/lib/mctb/texml-ingress/routing-profile";
import { buildInstantMctbInboundTexml } from "../src/lib/mctb/texml-ingress/inbound-texml";
import { MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID } from "../src/lib/mctb/texml-ingress/frozen-pipeline";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const E164_571 = "+15714073615";

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
  await test("fail-open profile builds press-1 TeXML synchronously", () => {
    const profile = buildFailOpenInboundRoutingProfile(E164_571);
    const built = buildInstantMctbInboundTexml({
      profile,
      fields: { ForwardedFrom: "+15555550100" },
      certMode: "D",
    });
    assert.ok(built);
    assert.equal(built!.branch, "press_1_gather");
    assert.match(built!.body, new RegExp(MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID));
    assert.match(built!.body, /<Gather[^>]*numDigits="1"/);
  });

  await test("fail-open build is sub-millisecond (no DB)", () => {
    const profile = buildFailOpenInboundRoutingProfile(E164_571);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      buildInstantMctbInboundTexml({
        profile,
        fields: {},
        certMode: "D",
      });
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 50, `expected <50ms for 1000 builds, got ${elapsed}ms`);
  });

  await test("warmed ws_1 571 profile includes platform press-1 URL", async () => {
    const profile = await warmMctbInboundRoutingProfileForE164(E164_571);
    assert.ok(profile);
    assert.equal(profile!.press1PlayUrl, platformPress1PlayUrl());
    assert.ok(profile!.voicemail.playUrl.startsWith("http"));
    assert.match(profile!.voicemail.playUrl, /g_[a-f0-9]+\/active\.mp3$/);
  });

  console.log("\nAll inbound instant TeXML tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
