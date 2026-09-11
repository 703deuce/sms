/**
 * Save-time TeXML ingress — must match frozen 866 cert (mctb-entry + default app).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-texml-mode-provision.ts
 */
import assert from "node:assert/strict";
import { buildInstantPress1Texml } from "../src/lib/mctb/texml-ingress/instant-press1-texml";
import { buildInstantVoicemailTexml } from "../src/lib/mctb/texml-ingress/instant-voicemail-texml";
import { resolveMctbTexmlHandlerMode } from "../src/lib/mctb/texml-ingress/texml-mode-provision";
import {
  frozenMctbTexmlProductionVoiceUrl,
  mctbTexmlEntryVoiceUrl,
} from "../src/lib/mctb/texml-ingress/texml-route";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
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

  test("frozen Telnyx voice_url is mctb-entry (same as 866 cert)", () => {
    const url = mctbTexmlEntryVoiceUrl();
    assert.match(url, /\/api\/telnyx\/voice\/mctb-entry$/);
    assert.doesNotMatch(url, /mctb-press-1|mctb-voicemail/);
  });

  test("frozen default TeXML app id matches 866 cert", () => {
    assert.equal(MCTB_TEXML_DEFAULT_APP_ID, "3037587396909598261");
  });

  test("frozen production voice_url matches 866 cert D (mctb-entry, no query)", () => {
    assert.equal(frozenMctbTexmlProductionVoiceUrl(), mctbTexmlEntryVoiceUrl());
    assert.doesNotMatch(frozenMctbTexmlProductionVoiceUrl(), /mctb-press-1|mctb-voicemail|\?cert=/);
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

  console.log("\nAll TeXML frozen ingress tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
