/**
 * Web/voice split deployment contract tests.
 * Run: npx tsx scripts/test-voice-web-split.ts
 */
import assert from "node:assert/strict";
import {
  inProcessVoiceRuntimeEnabled,
  voiceRuntimeImpl,
} from "../src/lib/voice/inprocess-voice-runtime";
import {
  internalVoiceRuntimeBaseUrl,
  verifyVoiceRuntimeInternalAuth,
  voiceRuntimeInternalSecret,
} from "../src/lib/voice/python-runtime-bridge/auth";
import { bootstrapInboundForPython } from "../src/lib/voice/python-runtime-bridge/bootstrap-inbound";

const originals: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  originals[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

try {
  setEnv("ENABLE_INPROCESS_VOICE_RUNTIME", undefined);
  setEnv("DISABLE_INPROCESS_VOICE_RUNTIME", undefined);
  setEnv("VOICE_RUNTIME_PROVIDER", "livekit");
  assert.equal(inProcessVoiceRuntimeEnabled(), false);

  setEnv("ENABLE_INPROCESS_VOICE_RUNTIME", "1");
  assert.equal(inProcessVoiceRuntimeEnabled(), true);

  setEnv("TRANSOVO_INTERNAL_API_KEY", "split-test-key");
  delete process.env.VOICE_RUNTIME_INTERNAL_SECRET;
  delete process.env.INTEGRATION_SECRET_KEY;
  assert.equal(voiceRuntimeInternalSecret(), "split-test-key");
  assert.equal(verifyVoiceRuntimeInternalAuth("Bearer split-test-key"), true);
  assert.equal(verifyVoiceRuntimeInternalAuth("Bearer wrong"), false);

  setEnv("TRANSOVO_BACKEND_URL", "https://app.example.com");
  assert.equal(internalVoiceRuntimeBaseUrl(), "https://app.example.com");

  // Bootstrap apiVersion is set in handler (mock routing would need DB — type check only)
  const bootstrapFn = bootstrapInboundForPython;
  assert.equal(typeof bootstrapFn, "function");

  assert.equal(voiceRuntimeImpl(), "python");

  console.log("test-voice-web-split: all passed");
} finally {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
