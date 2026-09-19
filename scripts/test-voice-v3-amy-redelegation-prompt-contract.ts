#!/usr/bin/env tsx
/**
 * Compiled Amy (GPT-Live) re-delegation contract — prompt assertions only.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

const callbackConfig = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
  },
};

const compiledLive = buildLiveFrontendInstructions({
  agentName: "Amy",
  businessName: "Cert Business",
  agentConfig: callbackConfig,
});

const bundle = buildVoiceV3Prompts({
  agentConfig: callbackConfig,
  businessName: "Cert Business",
  agentName: "Amy",
});

const artifactDir = "/opt/cursor/artifacts";
fs.mkdirSync(artifactDir, { recursive: true });
const artifactPath = path.join(artifactDir, "voice-v3-amy-compiled-live-instructions.txt");
fs.writeFileSync(
  artifactPath,
  `=== buildLiveFrontendInstructions ===\n${compiledLive}\n\n=== buildVoiceV3Prompts.live ===\n${bundle.liveInstructions}\n`,
  "utf8",
);

const lower = compiledLive.toLowerCase();

const required = [
  "does not automatically cancel backend work",
  "delegate again",
  "latest conversation",
  "running backend delegation is not proof",
  "re-delegation while backend work is running",
  "actually tuesday instead",
  "confirmed provider outcomes remain facts",
];

for (const phrase of required) {
  assert.ok(lower.includes(phrase), `Amy compiled instructions must include: ${phrase}`);
}

console.log("VOICE_V3_AMY_REDELEGATION_PROMPT_CONTRACT_PASS");
console.log("VOICE_V3_AMY_COMPILED_INSTRUCTIONS_ARTIFACT", artifactPath);
console.log("VOICE_V3_AMY_LIVE_MODEL_CERTIFICATION", "NOT_RUN_REQUIRES_LIVE_OR_PSTN");
