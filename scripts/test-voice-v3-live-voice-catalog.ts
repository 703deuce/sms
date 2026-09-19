#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { buildBasicLiveMediaSession } from "../src/lib/voice-v3-basic/live-session-config";
import {
  isVoiceV3LiveBuiltInVoice,
  normalizeVoiceV3LiveBuiltInVoice,
  VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS,
  VOICE_V3_WIZARD_LIVE_VOICES,
} from "../src/lib/voice-v3/config/voice-v3-live-built-in-voices";

function run(): void {
  const sdkUnionCount = 22;
  assert.equal(VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS.length, sdkUnionCount);
  assert.equal(VOICE_V3_WIZARD_LIVE_VOICES.length, sdkUnionCount);

  for (const id of VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS) {
    assert.ok(isVoiceV3LiveBuiltInVoice(id));
    assert.equal(normalizeVoiceV3LiveBuiltInVoice(id), id);
  }

  const legacyOnly = "ava-warm-us";
  assert.ok(!isVoiceV3LiveBuiltInVoice(legacyOnly));

  const wizard = createDefaultWizardState();
  wizard.voiceId = "cedar";
  const compiled = compileVoiceV3AgentConfig({
    wizard,
    source: "wizard_draft_test",
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  });
  assert.equal(compiled.telephony?.liveVoiceId, "cedar");

  const media = buildBasicLiveMediaSession(new Date(), compiled);
  const voice = media.audio?.output?.voice;
  assert.equal(typeof voice === "string" ? voice : (voice as { id?: string })?.id, "cedar");

  console.log("VOICE_V3_LIVE_VOICE_CATALOG", {
    GPT_LIVE_BUILT_IN_VOICE_COUNT: VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS.length,
    WIZARD_V3_VOICE_PICKER_COUNT: VOICE_V3_WIZARD_LIVE_VOICES.length,
  });
  console.log("VOICE_V3_LIVE_VOICE_CATALOG: PASS");
}

run();
