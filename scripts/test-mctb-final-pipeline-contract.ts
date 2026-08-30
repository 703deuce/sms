/**
 * Frozen MCTB pipeline contract — locks TeXML shapes for both consent modes.
 * No HTTP/DB. Run: npm run test:mctb-final-pipeline-contract
 *
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md (mctb_texml_final_v1)
 */
import assert from "node:assert/strict";
import {
  buildMctbConsentInboundTexml,
  buildMctbVoicemailGreetingTexml,
  getMctbConsentAudioAssetId,
} from "../src/lib/mctb/consent-prompt/texml-response";
import {
  MCTB_FINAL_PIPELINE_ID,
  MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID,
  MCTB_FINAL_PRODUCTION_CERT_MODE,
  MCTB_FINAL_PRODUCTION_CONSENT_PATH,
  MCTB_FINAL_PRODUCTION_ENTRY_PATH,
  MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
} from "../src/lib/mctb/texml-ingress/frozen-pipeline";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const FORWARDED_FROM = process.env.MCTB_TEST_FORWARDED_FROM || "+15555550100"; // pragma: allowlist secret

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("frozen pipeline id is mctb_texml_final_v1", () => {
  assert.equal(MCTB_FINAL_PIPELINE_ID, "mctb_texml_final_v1");
});

test("production entry and consent paths are stable", () => {
  assert.equal(MCTB_FINAL_PRODUCTION_ENTRY_PATH, "/api/telnyx/voice/mctb-entry");
  assert.equal(MCTB_FINAL_PRODUCTION_CONSENT_PATH, "/api/telnyx/voice/mctb-consent");
  assert.equal(MCTB_FINAL_PRODUCTION_CERT_MODE, "D");
});

test("press_1 uses consent audio asset inside Gather (play-gather)", () => {
  assert.equal(getMctbConsentAudioAssetId(), MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID);

  const built = buildMctbConsentInboundTexml(FORWARDED_FROM, { promptMode: "play-gather" });
  assert.equal(built.usesGather, true);
  assert.equal(built.usesPlay, true);
  assert.equal(built.usesSay, false);
  assert.match(built.body, /<Gather[^>]*numDigits="1"/);
  assert.match(built.body, new RegExp(MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID));
  assert.match(built.gatherActionUrl || "", /mctb-consent\?event=gather/);
  assert.match(built.gatherActionUrl || "", /path=texml_mctb_ingress/);
});

test("existing_consent uses voicemail greeting asset with Play+Record (no Gather)", () => {
  const playUrl = `https://app.example.com/api/public/smart-routing-audio/${MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID}`;
  const body = buildMctbVoicemailGreetingTexml({ playUrl, sayText: null });

  assert.match(body, /<Play>/);
  assert.match(body, new RegExp(MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID));
  assert.match(body, /<Record[^>]*recordingStatusCallback=/);
  assert.match(body, /mctb-texml-voicemail/);
  assert.doesNotMatch(body, /<Gather/);
  assert.doesNotMatch(body, new RegExp(MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID));
});

console.log("test-mctb-final-pipeline-contract: ok");
