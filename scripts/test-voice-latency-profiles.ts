/**
 * Latency profile + Flux opt-in A/B checks.
 * Run: npx tsx scripts/test-voice-latency-profiles.ts
 */
import assert from "node:assert/strict";
import {
  FLUX_EAGER_LOW_LATENCY_PROFILE,
  LEGACY_CASCADE_PROFILE,
  applyLatencyProfileToConfig,
  buildFluxTranscriptionSettings,
  isDeepgramFluxModel,
  rollbackLatencyProfileConfig,
  snapshotProviderLatencyFields,
} from "../src/lib/voice/latency-profiles";
import { DEFAULT_VOICE_CONFIG, parseVoiceAgentConfig } from "../src/lib/voice/types";
import { classifyResponseLatencyMs } from "../src/lib/voice/response-latency";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Defaults stay on legacy cascade (no auto-migrate)");
assert.equal(DEFAULT_VOICE_CONFIG.transcription?.sttModel, "deepgram/nova-3");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.endpointingMs, 300);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.bargeIn, true);

section("Flux profile uses Telnyx-documented defaults");
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.sttModel, "deepgram/flux");
assert.deepEqual(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.settings, {
  eot_threshold: 0.8,
  eager_eot_threshold: 0.4,
});
assert.equal(
  "eot_timeout_ms" in (FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.settings || {}),
  false,
);
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.voiceLanguage.endpointingMs, 100);
assert.equal(LEGACY_CASCADE_PROFILE.fields.transcription.sttModel, "deepgram/nova-3");

section("Apply snapshots rollback; rollback restores");
{
  const base = parseVoiceAgentConfig({
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/nova-3",
      language: "en",
    },
    voiceLanguage: {
      voiceId: "howard-ultra",
      endpointingMs: 300,
      silenceTimeoutMs: 800,
      bargeIn: true,
      speed: 1.4,
    },
  });
  const snap = snapshotProviderLatencyFields(base);
  assert.equal(snap.transcription.sttModel, "deepgram/nova-3");
  assert.equal(snap.voiceLanguage.endpointingMs, 300);
  assert.equal(snap.voiceLanguage.silenceTimeoutMs, 800);

  const applied = applyLatencyProfileToConfig(base, "flux_eager_low_latency");
  assert.equal(applied.transcription?.sttModel, "deepgram/flux");
  assert.equal(applied.transcription?.settings?.eot_threshold, 0.8);
  assert.equal(applied.transcription?.settings?.eager_eot_threshold, 0.4);
  assert.equal(applied.voiceLanguage?.endpointingMs, 100);
  assert.equal(applied.voiceLanguage?.bargeIn, true);
  assert.equal(applied.voiceLanguage?.speed, 1.4); // voice speed untouched
  assert.equal(applied.voiceTiming?.activeProfile, "flux_eager_low_latency");
  assert.ok(applied.voiceTiming?.rollbackSnapshot);

  const rolled = rollbackLatencyProfileConfig(applied);
  assert.equal(rolled.transcription?.sttModel, "deepgram/nova-3");
  assert.equal(rolled.voiceLanguage?.endpointingMs, 300);
  assert.equal(rolled.voiceLanguage?.silenceTimeoutMs, 800);
  assert.equal(rolled.voiceLanguage?.bargeIn, true);
}

section("Flux settings only for flux model");
{
  assert.equal(isDeepgramFluxModel("deepgram/flux"), true);
  assert.equal(isDeepgramFluxModel("deepgram/nova-3"), false);
  const fluxCfg = parseVoiceAgentConfig({
    transcription: {
      sttModel: "deepgram/flux",
      settings: { eot_threshold: 0.8, eager_eot_threshold: 0.4 },
    },
  });
  const settings = buildFluxTranscriptionSettings(fluxCfg);
  assert.ok(settings);
  assert.equal(settings!.eot_threshold, 0.8);
  assert.equal(settings!.eager_eot_threshold, 0.4);
  assert.equal(settings!.eot_timeout_ms, undefined);

  const novaCfg = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3" },
  });
  assert.equal(buildFluxTranscriptionSettings(novaCfg), undefined);
}

section("Latency bands: production goal under 600 ms");
assert.equal(classifyResponseLatencyMs(550), "natural");
assert.equal(classifyResponseLatencyMs(650), "usable");
assert.equal(classifyResponseLatencyMs(1100), "investigate");

console.log("\nAll latency profile checks passed.");
