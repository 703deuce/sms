import assert from "node:assert/strict";
import {
  isLabLiveKitTemplate,
  slimReceptionistCompiledForBootstrap,
} from "../src/lib/voice/python-runtime-bridge/bootstrap-payload";
import type { ReceptionistCompiledSnapshot } from "../src/lib/voice/receptionist/types";

const compiled = {
  livekitProfile: "frontdesk_realtime",
  businessName: "Test Co",
  agentDisplayName: "Amy",
  businessDescription: "We fix pipes",
  greeting: "Hi there",
  language: "en-US",
  timezone: "America/New_York",
  answerWhen: "every_call",
  capabilities: ["book_appointments"],
  fieldManifest: [],
  enabledBuiltinTools: ["book_appointment"],
  agentJobInstructions: "Book appointments",
  businessProfile: {},
  compiledPrompt: "X".repeat(20_000),
  businessContext: "X".repeat(20_000),
  realtimeModel: "[REDACTED]",
  realtimeOutputMode: "native",
  ttsModel: "[REDACTED]",
  voiceId: "marin",
  compiledAt: new Date().toISOString(),
} as ReceptionistCompiledSnapshot;

assert.equal(isLabLiveKitTemplate("livekit_frontdesk_booking"), true);
assert.equal(isLabLiveKitTemplate("transovo_receptionist_v1"), false);

const slim = slimReceptionistCompiledForBootstrap(compiled);
assert.equal(slim.compiledPrompt, "");
assert.equal(slim.businessContext, "");
assert.equal(slim.businessName, "Test Co");
assert.equal(slim.agentJobInstructions, "Book appointments");

const slimJson = JSON.stringify(slim);
const fullJson = JSON.stringify(compiled);
assert.ok(slimJson.length < fullJson.length / 10, "slim payload should be much smaller");

console.log("test-bootstrap-payload-slim: ok");
