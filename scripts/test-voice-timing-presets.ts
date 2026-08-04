/**
 * Voice timing cleanup + latency instrumentation checks.
 * Run: npx tsx scripts/test-voice-timing-presets.ts
 */

import assert from "node:assert/strict";
import {
  CONVERSATIONAL_PROMPT_GUIDANCE,
  EXPERIMENTAL_VOICE_TIMING_PRESETS,
  SHARED_LATENCY_TARGETS,
  getExperimentalVoiceTimingPreset,
} from "../src/lib/voice/timing-presets";
import {
  STREAMING_PIPELINE_AUDIT,
  breakdownFromStages,
  classifyResponseLatencyMs,
  deriveLatencyFromTranscriptSegments,
  summarizeResponseLatency,
} from "../src/lib/voice/response-latency";
import { DEFAULT_VOICE_CONFIG, parseVoiceAgentConfig } from "../src/lib/voice/types";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Defaults restored to pre-tuning values");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.speed, 1);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.endpointingMs, 300);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.silenceTimeoutMs, 2500);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.bargeIn, true);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.timingPreset, undefined);

section("Presets are experimental and not auto-applied");
{
  const preset = getExperimentalVoiceTimingPreset("NATURAL_DEFAULT");
  assert.ok(preset);
  assert.equal(preset!.status, "experimental");
  assert.equal(
    EXPERIMENTAL_VOICE_TIMING_PRESETS.FAST_RECEPTIONIST.status,
    "experimental",
  );
  // parse without timingPreset must not invent one
  const parsed = parseVoiceAgentConfig({
    voiceLanguage: { voiceId: "allie-ultra" },
  });
  assert.equal(parsed.voiceLanguage?.timingPreset, undefined);
  // speed stays at default merge (1) unless explicitly set
  assert.equal(parsed.voiceLanguage?.speed, 1);
}

section("Reporting bands are guidance only (not delays)");
assert.equal(classifyResponseLatencyMs(350), "excellent");
assert.equal(classifyResponseLatencyMs(500), "natural");
assert.equal(classifyResponseLatencyMs(700), "usable");
assert.equal(classifyResponseLatencyMs(900), "slow");
assert.equal(classifyResponseLatencyMs(1200), "investigate");
assert.equal(classifyResponseLatencyMs(1800), "poor");
assert.equal(SHARED_LATENCY_TARGETS.medianWarningMs, 1000);

section("Stage breakdown + transcript-derived latency");
{
  const stages = {
    callerTurnEndedAt: 1000,
    transcriptReadyAt: 1150,
    llmFirstTokenAt: 1300,
    ttsFirstAudioReadyAt: 1450,
    agentFirstAudibleAudioAt: 1500,
  };
  const breakdown = breakdownFromStages(stages);
  assert.equal(breakdown.endOfTurnToFirstAudioMs, 500);
  assert.equal(breakdown.sttLatencyMs, 150);
  assert.equal(breakdown.llmFirstTokenLatencyMs, 150);
  assert.equal(breakdown.ttsFirstAudioLatencyMs, 150);

  const samples = deriveLatencyFromTranscriptSegments([
    { speaker: "inbound", startMs: 0, endMs: 1000 },
    { speaker: "outbound", startMs: 1500, endMs: 2000 },
    { speaker: "inbound", startMs: 3000, endMs: 4000 },
    { speaker: "outbound", startMs: 4600, endMs: 5000 },
  ]);
  assert.equal(samples.length, 2);
  assert.equal(samples[0].latencyMs, 500);
  assert.equal(samples[0].category, "first_response");
  assert.equal(samples[1].category, "conversational");
  assert.equal(
    samples[0].breakdown?.endOfTurnToFirstAudioMs,
    500,
  );

  const summary = summarizeResponseLatency(samples);
  assert.equal(summary.metricDefinition, "caller_end_of_speech_to_first_audible_agent_audio");
  assert.equal(summary.p50Ms, 500);
  assert.equal(summary.p95Ms, 600);
  assert.ok(summary.byCategory?.first_response);
}

section("Soft conversational guidance (prompt only)");
assert.match(CONVERSATIONAL_PROMPT_GUIDANCE, /one question at a time/i);
assert.match(CONVERSATIONAL_PROMPT_GUIDANCE, /do not narrate/i);
assert.doesNotMatch(CONVERSATIONAL_PROMPT_GUIDANCE, /25 words/i);
assert.doesNotMatch(CONVERSATIONAL_PROMPT_GUIDANCE, /15%/i);
assert.doesNotMatch(CONVERSATIONAL_PROMPT_GUIDANCE, /3000/i);

section("Streaming audit checklist present");
assert.equal(STREAMING_PIPELINE_AUDIT.expectStreamingStt, true);
assert.equal(STREAMING_PIPELINE_AUDIT.expectStreamingLlm, true);
assert.equal(STREAMING_PIPELINE_AUDIT.expectStreamingTts, true);
assert.ok(STREAMING_PIPELINE_AUDIT.antiPatterns.includes("wait_for_complete_llm_response_before_tts"));

section("Telnyx sync mapping helpers for speculative presets are gone");
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../src/lib/voice/timing-presets") as Record<string, unknown>;
  assert.equal("buildTelnyxInterruptionSettings" in mod, false);
  assert.equal("buildTelnyxTranscriptionSettings" in mod, false);
  assert.equal("resolveVoiceSpeed" in mod, false);
  assert.equal("resolveVoiceTiming" in mod, false);
}

console.log("\nAll voice timing cleanup checks passed.");
