/**
 * Assert mctb-entry cert B2 returns Play TeXML pointing at valid production audio.
 *
 * Run: npx tsx scripts/test-mctb-texml-b2-play-route.ts
 */
import assert from "node:assert/strict";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { getMctbConsentPlaybackUrl } from "../src/lib/mctb/consent-prompt/texml-response";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";
import { validateMctbConsentAudioUrl } from "./validate-mctb-consent-audio-url";

async function main() {
  const audio = await validateMctbConsentAudioUrl();
  console.log(JSON.stringify({ audioProbe: audio }, null, 2));
  assert.equal(audio.ok, true, "consent audio URL must be valid for Telnyx Play");

  const entryUrl = `${getTelnyxWebhookUrls().mctbEntry}?cert=B2`;
  const texml = await preflightTexmlVoiceUrl(entryUrl);
  console.log(JSON.stringify({ texmlPreflight: texml }, null, 2));

  assert.equal(texml.ok, true, "mctb-entry?cert=B2 must return 200 XML");
  assert.ok(texml.bodyPreview.includes("<Play>"), "B2 must include Play");
  assert.ok(
    texml.bodyPreview.includes(getMctbConsentPlaybackUrl().replace(/&/g, "&amp;")) ||
      texml.bodyPreview.includes(getMctbConsentPlaybackUrl()),
    "B2 Play URL must reference production consent audio",
  );
  assert.equal(texml.isHtml, false, "B2 must not return HTML");

  console.log("PASS: cert B2 Play route + audio URL");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
