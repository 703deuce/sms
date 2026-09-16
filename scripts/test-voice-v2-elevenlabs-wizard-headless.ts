/**
 * ElevenLabs wizard catalog + publish voice resolution.
 * Run: npx tsx scripts/test-voice-v2-elevenlabs-wizard-headless.ts
 */
import assert from "node:assert/strict";
import { buildAssistantVoiceSettings } from "../src/lib/voice/telnyx/voices";
import {
  DEFAULT_VOICE_V2_WIZARD_CATALOG_ID,
  VOICE_V2_WIZARD_ELEVENLABS_VOICES,
  resolveVoiceV2WizardVoiceForPublish,
  validateVoiceV2WizardVoiceId,
} from "../src/lib/solutions/appointment-receptionist/voice-v2-wizard-elevenlabs-catalog";
import { isElevenLabsProviderVoice } from "../src/lib/voice/elevenlabs/models";

const ids = new Set<string>();
for (const v of VOICE_V2_WIZARD_ELEVENLABS_VOICES) {
  assert.ok(!ids.has(v.catalogId), `duplicate catalog id ${v.catalogId}`);
  ids.add(v.catalogId);
  assert.ok(v.catalogId.startsWith("el:"));
  const built = buildAssistantVoiceSettings({ voiceRef: v.catalogId });
  assert.ok(built.isElevenLabs, v.catalogId);
  assert.ok(isElevenLabsProviderVoice(built.providerVoiceId), built.providerVoiceId);
}

const jessica = resolveVoiceV2WizardVoiceForPublish(DEFAULT_VOICE_V2_WIZARD_CATALOG_ID);
const builtDefault = buildAssistantVoiceSettings({ voiceRef: jessica.catalogId });
assert.ok(builtDefault.isElevenLabs);
assert.ok(!String(builtDefault.providerVoiceId).includes("NaturalHD"));

assert.equal(validateVoiceV2WizardVoiceId("ava-warm-us").ok, true);
assert.equal(validateVoiceV2WizardVoiceId("not-a-real-voice").ok, false);

console.log("PASS voice-v2-elevenlabs-wizard-headless");
