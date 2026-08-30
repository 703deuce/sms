/**
 * Regression tests for turn/generation isolation.
 * Run: npx tsx scripts/test-generation-context.ts
 */
import assert from "node:assert/strict";
import {
  advanceCallerTurn,
  cancelActiveGeneration,
  clearCallGenerationState,
  getActiveGeneration,
  isGenerationActive,
  startAssistantGeneration,
} from "../src/lib/voice/tts/generation-context";

function main() {
  const callId = "test-call-gen-ctx";

  const g1 = startAssistantGeneration(callId, 1);
  assert.equal(g1.turnId, 1);
  assert.ok(isGenerationActive(callId, g1.generationId));

  const g2 = startAssistantGeneration(callId, 1);
  assert.notEqual(g1.generationId, g2.generationId);
  assert.equal(isGenerationActive(callId, g1.generationId), false);
  assert.equal(isGenerationActive(callId, g2.generationId), true);

  const cancelled = cancelActiveGeneration(callId, "test_interrupt");
  assert.equal(cancelled, g2.generationId);
  assert.equal(isGenerationActive(callId, g2.generationId), false);

  const turn2 = advanceCallerTurn(callId);
  assert.equal(turn2, 2);
  const active = getActiveGeneration(callId);
  assert.ok(active);
  assert.equal(active!.turnId, 2);

  const g3 = startAssistantGeneration(callId);
  assert.equal(g3.turnId, 2);
  assert.ok(isGenerationActive(callId, g3.generationId));

  clearCallGenerationState(callId);
  assert.equal(getActiveGeneration(callId), null);

  console.log("test-generation-context: PASS");
}

main();
