/**
 * Unit checks for voice timing presets + Telnyx field mapping + Astra speed rule.
 * Run: npx tsx scripts/test-voice-timing-presets.ts
 */

import assert from "node:assert/strict";
import {
  ASTRA_VOICE_SPEED,
  DEFAULT_AGENT_VOICE_SPEED,
  buildTelnyxInterruptionSettings,
  buildTelnyxTranscriptionSettings,
  buildTelnyxUserIdleReplySecs,
  getVoiceTimingPreset,
  isAstraVoice,
  resolveVoiceSpeed,
  resolveVoiceTiming,
} from "../src/lib/voice/timing-presets";
import {
  classifyResponseLatencyMs,
  deriveLatencyFromTranscriptSegments,
  summarizeResponseLatency,
} from "../src/lib/voice/response-latency";
import { DEFAULT_VOICE_CONFIG, parseVoiceAgentConfig } from "../src/lib/voice/types";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Astra detection + speed defaults");
assert.equal(isAstraVoice("ava-warm-us"), true);
assert.equal(isAstraVoice("Telnyx.NaturalHD.astra"), true);
assert.equal(isAstraVoice("allie-ultra"), false);
assert.equal(
  resolveVoiceSpeed({ voiceId: "ava-warm-us" }),
  ASTRA_VOICE_SPEED,
);
assert.equal(
  resolveVoiceSpeed({ voiceId: "allie-ultra" }),
  DEFAULT_AGENT_VOICE_SPEED,
);
assert.equal(DEFAULT_AGENT_VOICE_SPEED, 1.3);
assert.equal(ASTRA_VOICE_SPEED, 0.98);
assert.equal(
  resolveVoiceSpeed({ voiceId: "allie-ultra", explicitSpeed: 1.5 }),
  1.5,
);

section("Default voice config uses Astra natural speed + NATURAL preset");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.voiceId, "ava-warm-us");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.speed, 0.98);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.timingPreset, "NATURAL_DEFAULT");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.endpointingMs, 200);

section("NATURAL_DEFAULT Telnyx mapping (nova-3)");
{
  const preset = getVoiceTimingPreset("NATURAL_DEFAULT");
  assert.equal(preset.turnDetection.responseStartDelayMs, 200);
  assert.equal(preset.turnDetection.minTurnSilenceMs, 350);
  assert.equal(preset.speech.speed, 1.3);

  const interruption = buildTelnyxInterruptionSettings(preset, {
    sttModel: "deepgram/nova-3",
  });
  assert.equal(interruption.enable, true);
  const plan = interruption.start_speaking_plan as Record<string, unknown>;
  assert.equal(plan.wait_seconds, 0.2);
  const endpointing = plan.transcription_endpointing_plan as Record<string, number>;
  assert.ok(endpointing);
  assert.equal(endpointing.on_punctuation_seconds, 0.1);
  assert.equal(endpointing.on_no_punctuation_seconds, 0.35);

  const settings = buildTelnyxTranscriptionSettings("deepgram/nova-3", preset);
  assert.deepEqual(settings, { smart_format: true, numerals: true });
  assert.equal(buildTelnyxUserIdleReplySecs(preset), 5);
}

section("AssemblyAI + Flux settings only when those models are selected");
{
  const preset = getVoiceTimingPreset("NATURAL_DEFAULT");
  const assembly = buildTelnyxTranscriptionSettings(
    "assemblyai/universal-streaming",
    preset,
  );
  assert.deepEqual(assembly, {
    end_of_turn_confidence_threshold: 0.45,
    min_turn_silence: 350,
    max_turn_silence: 1000,
  });

  const flux = buildTelnyxTranscriptionSettings("deepgram/flux", preset);
  assert.deepEqual(flux, {
    eot_threshold: 0.8,
    eager_eot_threshold: 0.4,
    eot_timeout_ms: 2500,
  });

  const fluxInterrupt = buildTelnyxInterruptionSettings(preset, {
    sttModel: "deepgram/flux",
  });
  const plan = fluxInterrupt.start_speaking_plan as Record<string, unknown>;
  assert.equal(plan.wait_seconds, 0.2);
  assert.equal(plan.transcription_endpointing_plan, undefined);
}

section("FAST / PATIENT / NOISY presets");
{
  const fast = getVoiceTimingPreset("FAST_RECEPTIONIST");
  assert.equal(fast.turnDetection.minTurnSilenceMs, 275);
  assert.equal(fast.turnDetection.responseStartDelayMs, 100);
  assert.equal(fast.interruption.sensitivityNormalized, 0.9);

  const patient = getVoiceTimingPreset("PATIENT_INTAKE");
  assert.equal(patient.turnDetection.endOfTurnConfidenceThreshold, 0.55);
  assert.equal(patient.turnDetection.maxTurnSilenceMs, 1500);

  const noisy = getVoiceTimingPreset("NOISY_ENVIRONMENT");
  assert.equal(noisy.interruption.sensitivityNormalized, 0.7);
  assert.equal(noisy.interruption.minimumSpeechMs, 450);
}

section("resolveVoiceTiming Astra vs non-Astra");
{
  const astra = resolveVoiceTiming({
    presetId: "NATURAL_DEFAULT",
    voiceId: "ava-warm-us",
  });
  assert.equal(astra.speed, 0.98);

  const other = resolveVoiceTiming({
    presetId: "NATURAL_DEFAULT",
    voiceId: "allie-ultra",
  });
  assert.equal(other.speed, 1.3);
}

section("Response latency metric (not LLM time)");
{
  assert.equal(classifyResponseLatencyMs(450), "very_good");
  assert.equal(classifyResponseLatencyMs(900), "usable");
  assert.equal(classifyResponseLatencyMs(1600), "poor");

  const samples = deriveLatencyFromTranscriptSegments([
    { speaker: "inbound", startMs: 0, endMs: 1000 },
    { speaker: "outbound", startMs: 1500, endMs: 2000 },
    { speaker: "inbound", startMs: 3000, endMs: 4000 },
    { speaker: "outbound", startMs: 4600, endMs: 5000 },
  ]);
  assert.equal(samples.length, 2);
  assert.equal(samples[0].latencyMs, 500);
  assert.equal(samples[1].latencyMs, 600);
  assert.equal(samples[0].source, "transcription_segments");

  const summary = summarizeResponseLatency(samples);
  assert.equal(summary.metricDefinition, "caller_end_of_speech_to_first_audible_agent_audio");
  assert.equal(summary.medianMs, 500);
  assert.equal(summary.targets.medianTargetMs, 500);
}

section("parseVoiceAgentConfig preserves timing fields");
{
  const parsed = parseVoiceAgentConfig({
    voiceLanguage: {
      voiceId: "allie-ultra",
      speed: 1.3,
      timingPreset: "FAST_RECEPTIONIST",
    },
    voiceTiming: { presetId: "FAST_RECEPTIONIST" },
  });
  assert.equal(parsed.voiceLanguage?.timingPreset, "FAST_RECEPTIONIST");
  assert.equal(parsed.voiceTiming?.presetId, "FAST_RECEPTIONIST");
  assert.equal(parsed.voiceLanguage?.speed, 1.3);

  const nonAstraNoSpeed = parseVoiceAgentConfig({
    voiceLanguage: { voiceId: "allie-ultra" },
  });
  assert.equal(nonAstraNoSpeed.voiceLanguage?.speed, 1.3);

  const astraDefault = parseVoiceAgentConfig({});
  assert.equal(astraDefault.voiceLanguage?.speed, 0.98);
}

console.log("\nAll voice timing preset checks passed.");
