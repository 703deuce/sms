/**
 * Collection realtime control + inbound VAD defaults.
 * Run: npx tsx scripts/test-collection-realtime-control.ts
 */
import assert from "node:assert/strict";
import {
  resolveFrontDeskInboundRealtimeTurnDetection,
  resolveOutboundRealtimeVadMode,
} from "../voice-runtime/src/realtime-turn-config";

const prevMode = process.env.VOICE_REALTIME_VAD_MODE;
delete process.env.VOICE_REALTIME_VAD_MODE;

const inbound = resolveFrontDeskInboundRealtimeTurnDetection();
assert.equal(inbound.mode, "semantic");
assert.equal(inbound.turnDetection.type, "semantic_vad");
if (inbound.turnDetection.type === "semantic_vad") {
  assert.equal(inbound.turnDetection.eagerness, "medium");
  assert.equal(inbound.turnDetection.create_response, true);
}

process.env.VOICE_REALTIME_VAD_MODE = "server";
const serverInbound = resolveFrontDeskInboundRealtimeTurnDetection();
assert.equal(serverInbound.turnDetection.type, "server_vad");
if (serverInbound.turnDetection.type === "server_vad") {
  assert.equal(serverInbound.turnDetection.silence_duration_ms, 700);
}

if (prevMode) process.env.VOICE_REALTIME_VAD_MODE = prevMode;
else delete process.env.VOICE_REALTIME_VAD_MODE;

assert.equal(resolveOutboundRealtimeVadMode(), "semantic");

console.log("✓ collection realtime control tests passed");
