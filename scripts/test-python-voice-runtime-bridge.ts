/**
 * Python voice runtime bridge and env routing.
 * Run: npx tsx scripts/test-python-voice-runtime-bridge.ts
 */
import assert from "node:assert/strict";
import { voiceRuntimeImpl } from "../src/lib/voice/inprocess-voice-runtime";
import { verifyVoiceRuntimeInternalAuth } from "../src/lib/voice/python-runtime-bridge/auth";

const originalImpl = process.env.VOICE_RUNTIME_IMPL;
const originalSecret = process.env.VOICE_RUNTIME_INTERNAL_SECRET;

try {
  process.env.VOICE_RUNTIME_INTERNAL_SECRET = "test-secret-bridge";
  assert.equal(verifyVoiceRuntimeInternalAuth("Bearer test-secret-bridge"), true);
  assert.equal(verifyVoiceRuntimeInternalAuth("Bearer wrong"), false);

  process.env.VOICE_RUNTIME_IMPL = "typescript";
  assert.equal(voiceRuntimeImpl(), "typescript");

  process.env.VOICE_RUNTIME_IMPL = "python";
  assert.equal(voiceRuntimeImpl(), "python");

  delete process.env.VOICE_RUNTIME_IMPL;
  assert.equal(voiceRuntimeImpl(), "python");

  console.log("test-python-voice-runtime-bridge: all passed");
} finally {
  if (originalImpl === undefined) delete process.env.VOICE_RUNTIME_IMPL;
  else process.env.VOICE_RUNTIME_IMPL = originalImpl;
  if (originalSecret === undefined) delete process.env.VOICE_RUNTIME_INTERNAL_SECRET;
  else process.env.VOICE_RUNTIME_INTERNAL_SECRET = originalSecret;
}
