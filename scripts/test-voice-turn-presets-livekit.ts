/**
 * LiveKit turn preset + Flux STT config tests.
 * Run: npx tsx scripts/test-voice-turn-presets-livekit.ts
 */
import assert from "node:assert/strict";
import {
  buildAmyTurnHandling,
  describeTurnHandlingConfig,
  isFluxEagerPreset,
} from "../voice-runtime/src/turn-config";
import { buildAmySttConfig } from "../voice-runtime/src/stt-config";

function main() {
  process.env.VOICE_TURN_PRESET = "ultra_low";
  delete process.env.VOICE_ENDPOINTING_MAX_MS;
  delete process.env.VOICE_STT_MODEL;

  const ultraHandling = buildAmyTurnHandling();
  assert.equal(typeof ultraHandling.turnDetection, "object");
  assert.equal(ultraHandling.endpointing.maxDelay, 400);
  assert.equal(isFluxEagerPreset(), false);
  assert.equal(buildAmySttConfig().mode, "nova");
  assert.equal(buildAmySttConfig().model, "deepgram/nova-3");

  process.env.VOICE_TURN_PRESET = "flux_eager";
  const fluxHandling = buildAmyTurnHandling();
  assert.equal(fluxHandling.turnDetection, "stt");
  assert.equal(fluxHandling.endpointing.maxDelay, 50);
  assert.equal(fluxHandling.preemptiveGeneration.preemptiveTts, true);
  assert.equal(isFluxEagerPreset(), true);

  const sttCfg = buildAmySttConfig();
  assert.equal(sttCfg.mode, "flux");
  assert.equal(sttCfg.model, "deepgram/flux-general-en");
  assert.equal(sttCfg.modelOptions?.eager_eot_threshold, 0.3);
  assert.equal(sttCfg.modelOptions?.eot_threshold, 0.7);
  assert.equal(sttCfg.modelOptions?.eot_timeout_ms, 5000);

  const desc = describeTurnHandlingConfig();
  assert.equal(desc.turnDetection, "stt");
  assert.equal(desc.turnDetector, null);
  assert.equal((desc.fluxEot as { eagerEotThreshold: number }).eagerEotThreshold, 0.3);

  console.log("voice turn preset livekit tests: PASS");
}

main();
