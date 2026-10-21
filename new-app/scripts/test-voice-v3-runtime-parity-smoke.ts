#!/usr/bin/env npx tsx
/**
 * In-process smoke for new-app Voice V3 runtime modules (no PSTN, no DB).
 */
import assert from "node:assert/strict";
import {
  classifyVoiceToolFreshness,
  shouldBlockStaleToolPreDispatch,
} from "@/lib/server/voice-v3/delegation/conversation-freshness";
import { getMissingFieldsForOperation } from "@/lib/server/voice-v3/intake-objective/operation-requirements";
import { createInitialVoiceV3CallContext } from "@/lib/server/voice-v3/state/call-context";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";
import { voiceV3DelegationParallelToolCallsEnabled } from "@/lib/server/voice-v3/tools/concurrency-policy";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "@/lib/server/voice-v3/tools/voice-tool-catalog";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "../../scripts/voice-v3-booking-test-config";

assert.equal(classifyVoiceToolFreshness("book_appointment"), "COMMITTED_WRITE");
assert.equal(shouldBlockStaleToolPreDispatch("set_scheduling_preference", "STALE"), true);
assert.equal(typeof voiceV3DelegationParallelToolCallsEnabled(), "boolean");

const cfg = VOICE_V3_BOOKING_TEST_CONFIG as VoiceV3AgentConfig;
const tools = buildVoiceV3AstraFunctionToolsFromCatalog({
  ...cfg,
  runtimeProfile: "full_receptionist",
});
const names = tools.map((t) => String(t.name));
assert.ok(names.includes("book_appointment"));
assert.ok(names.includes("find_availability"));
assert.ok(names.includes("set_scheduling_preference"));

const ctx = createInitialVoiceV3CallContext({
  callId: "call_test",
  liveSessionId: "live_test",
  workspaceId: "ws_test",
});
const missing = getMissingFieldsForOperation("book_appointment", cfg, ctx);
assert.ok(missing.length > 0, "book gate requires intake when empty");

console.log("test-voice-v3-runtime-parity-smoke: ALL PASS");
