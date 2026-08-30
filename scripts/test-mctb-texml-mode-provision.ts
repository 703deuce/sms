/**
 * Save-time TeXML handler mode routing — press-1 vs voicemail URLs, zero-lookup ingress.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-texml-mode-provision.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildInstantPress1Texml } from "../src/lib/mctb/texml-ingress/instant-press1-texml";
import { buildInstantVoicemailTexml } from "../src/lib/mctb/texml-ingress/instant-voicemail-texml";
import {
  buildMctbTexmlVoiceUrlForHandler,
  resolveMctbTexmlHandlerMode,
} from "../src/lib/mctb/texml-ingress/texml-mode-provision";
import { MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED } from "../src/lib/mctb/consent-mode";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const E164 = "+15714073615";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

async function main() {
  test("press_1 mode when consent is press_1 and automation active", () => {
    assert.equal(
      resolveMctbTexmlHandlerMode({
        consentMode: MCTB_CONSENT_MODE_VERIFIED,
        automationActive: true,
      }),
      "press_1",
    );
  });

  test("voicemail mode when consent is existing_consent", () => {
    assert.equal(
      resolveMctbTexmlHandlerMode({
        consentMode: MCTB_CONSENT_MODE_EXISTING,
        automationActive: true,
      }),
      "voicemail",
    );
  });

  test("voicemail mode when automation paused", () => {
    assert.equal(
      resolveMctbTexmlHandlerMode({
        consentMode: MCTB_CONSENT_MODE_VERIFIED,
        automationActive: false,
      }),
      "voicemail",
    );
  });

  test("press-1 voice_url points at mctb-press-1 handler", () => {
    const url = buildMctbTexmlVoiceUrlForHandler("press_1", E164);
    assert.match(url, /\/api\/telnyx\/voice\/mctb-press-1/);
    assert.match(url, /[?&]r=r_/);
    assert.doesNotMatch(url, /mctb-entry/);
  });

  test("voicemail voice_url points at mctb-voicemail handler", () => {
    const url = buildMctbTexmlVoiceUrlForHandler("voicemail", E164);
    assert.match(url, /\/api\/telnyx\/voice\/mctb-voicemail/);
    assert.match(url, /[?&]g=g_/);
    assert.match(url, /[?&]r=r_/);
    assert.doesNotMatch(url, /mctb-entry/);
  });

  test("mctb-press-1 route has no prisma/profile lookup", async () => {
    const src = await readFile(
      path.join(process.cwd(), "src/app/api/telnyx/voice/mctb-press-1/route.ts"),
      "utf8",
    );
    assert.ok(!/getPrisma|prisma\./.test(src), "found DB in press-1 ingress");
    assert.ok(!/peekMctbInboundRoutingProfile/.test(src), "found profile peek");
  });

  test("instant press-1 TeXML builds synchronously", () => {
    const built = buildInstantPress1Texml({
      toE164: E164,
      fields: { ForwardedFrom: "+15555550100" },
    });
    assert.match(built.body, /<Gather[^>]*numDigits="1"/);
    assert.ok(built.press1PlayUrl.startsWith("http"));
  });

  test("instant voicemail TeXML builds synchronously", () => {
    const built = buildInstantVoicemailTexml({ toE164: E164 });
    assert.match(built.playUrl, /g_[a-f0-9]+\/active\.mp3$/);
    assert.match(built.body, /<Play>/);
    assert.match(built.body, /<Record/);
  });

  console.log("\nAll TeXML mode provision tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
