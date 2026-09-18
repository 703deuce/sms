import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import { resolveVoiceV3AgentConfig } from "../src/lib/voice-v3/state/call-runtime";

function main() {
  const prev = process.env.VOICE_V3_AGENT_CONFIG_PROFILE;
  delete process.env.VOICE_V3_AGENT_CONFIG_PROFILE;

  const defaultConfig = resolveVoiceV3AgentConfig();
  assert.equal(defaultConfig, VOICE_V3_BOOKING_AGENT_CONFIG);
  assert.deepEqual(
    defaultConfig.intakeFields.map((f) => f.key).sort(),
    ["email", "name", "phone"],
  );
  assert.ok(!defaultConfig.intakeFields.some((f) => f.key === "mothers_name"));
  assert.ok(!defaultConfig.intakeFields.some((f) => f.key === "favorite_dinosaur"));

  process.env.VOICE_V3_AGENT_CONFIG_PROFILE = "test";
  assert.equal(resolveVoiceV3AgentConfig(), TEST_AGENT_CONFIG);
  assert.ok(TEST_AGENT_CONFIG.intakeFields.some((f) => f.key === "mothers_name"));

  if (prev === undefined) delete process.env.VOICE_V3_AGENT_CONFIG_PROFILE;
  else process.env.VOICE_V3_AGENT_CONFIG_PROFILE = prev;

  console.log("PASS voice-v3 pipeline config (booking default, test harness opt-in)");
}

main();
