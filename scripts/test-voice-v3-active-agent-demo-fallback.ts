#!/usr/bin/env npx tsx
/**
 * Proves ACTIVE production agents cannot receive VOICE_V3_BOOKING_AGENT_CONFIG silently.
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config.ts";
import {
  assertActiveAgentMayUseDemoConfigFallback,
  voiceV3AllowsDemoConfigFallback,
  VoiceV3AgentConfigResolutionError,
} from "../src/lib/voice-v3/config/demo-config-fallback.ts";

const savedNodeEnv = process.env.NODE_ENV;
const savedAllow = process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK;

function restoreEnv(): void {
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
  if (savedAllow === undefined) delete process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK;
  else process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK = savedAllow;
}

try {
  process.env.NODE_ENV = "production";
  delete process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK;
  assert.equal(voiceV3AllowsDemoConfigFallback(), false);

  assert.throws(
    () =>
      assertActiveAgentMayUseDemoConfigFallback({
        workspaceId: "ws_cert",
        agentId: "agent_cert",
        agentStatus: "ACTIVE",
        reason: "test_missing_wizard",
      }),
    (err: unknown) => err instanceof VoiceV3AgentConfigResolutionError,
  );

  assert.doesNotThrow(() =>
    assertActiveAgentMayUseDemoConfigFallback({
      workspaceId: "ws_cert",
      agentId: "agent_cert",
      agentStatus: "DRAFT",
      reason: "test_draft",
    }),
  );

  process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK = "1";
  assert.equal(voiceV3AllowsDemoConfigFallback(), true);
  assert.doesNotThrow(() =>
    assertActiveAgentMayUseDemoConfigFallback({
      workspaceId: "ws_cert",
      agentId: "agent_cert",
      agentStatus: "ACTIVE",
      reason: "test_explicit_allow",
    }),
  );

  assert.notEqual(
    VOICE_V3_BOOKING_AGENT_CONFIG.identity?.agentName,
    undefined,
    "demo config exists for dev-only fallback",
  );

  console.log("test-voice-v3-active-agent-demo-fallback: PASS");
} finally {
  restoreEnv();
}
