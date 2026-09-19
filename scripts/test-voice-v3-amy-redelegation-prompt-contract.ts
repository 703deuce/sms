#!/usr/bin/env tsx
/**
 * Amy compiled-instruction contract: re-delegate when caller redirects during backend work.
 * Does NOT prove Live model behavior without audio — prompt contract only.
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildLiveDelegationPolicySection } from "../src/lib/voice-v3/prompts/live-delegation-policy";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";

const callbackConfig = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
  },
};

const policy = buildLiveDelegationPolicySection(callbackConfig).toLowerCase();
assert.ok(
  policy.includes("does not automatically cancel backend work"),
  "Amy policy must state backend work continues on interruption",
);
assert.ok(
  policy.includes("delegate again") && policy.includes("latest conversation"),
  "Amy policy must instruct re-delegation with latest conversation after redirect",
);
assert.ok(
  policy.includes("correction changes backend work") ||
    policy.includes("changes backend work"),
  "Amy policy must cover in-flight backend corrections",
);

const frontend = buildLiveFrontendInstructions({ agentConfig: callbackConfig }).toLowerCase();
assert.ok(
  frontend.includes("delegate again") || frontend.includes("delegate the correction"),
  "Live frontend instructions must mention re-delegation on correction",
);

console.log("VOICE_V3_AMY_REDELEGATION_PROMPT_CONTRACT_PASS");
console.log(
  "VOICE_V3_AMY_LIVE_MODEL_CERTIFICATION",
  "NOT_RUN_REQUIRES_AUDIO_OR_LIVE_SESSION",
);
