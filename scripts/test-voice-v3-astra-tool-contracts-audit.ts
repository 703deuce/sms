/**
 * Static audit: production Astra tool contracts (no live API).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

const tools = buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG);
const names = [
  "update_intake",
  "find_availability",
  "book_appointment",
  "find_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "transfer_call",
  "end_call",
];

assert.equal(tools.length, names.length);
for (const expected of names) {
  const t = tools.find((row) => row.name === expected);
  assert.ok(t, `missing tool ${expected}`);
  assert.ok(t.description && t.description.length >= 200, `${expected} description too short`);
  assert.equal(t.strict, true, `${expected} must be strict`);
  const params = t.parameters as {
    properties?: Record<string, { description?: string }>;
    required?: string[];
    additionalProperties?: boolean;
  };
  assert.ok(params.properties, `${expected} must have properties`);
  assert.equal(params.additionalProperties, false, `${expected} must set additionalProperties false`);
  const required = params.required ?? [];
  for (const key of Object.keys(params.properties)) {
    assert.ok(required.includes(key), `${expected}.${key} must be listed in required (strict)`);
  }
  for (const [key, prop] of Object.entries(params.properties)) {
    assert.ok(
      prop.description && prop.description.length >= 8,
      `${expected}.${key} missing parameter description`,
    );
  }
}

const update = tools.find((t) => t.name === "update_intake")!;
const updateProps = (update.parameters as { properties?: Record<string, unknown> }).properties ?? {};
assert.ok(!("date_expression" in updateProps), "update_intake must not expose date_expression");
assert.ok(!("time_expression" in updateProps), "update_intake must not expose time_expression");

const prompts = buildVoiceV3Prompts({
  ...resolveVoiceV3DefaultPromptInput(new Date()),
  agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
});
assert.ok(prompts.astraInstructions.includes("New booking path"));
assert.ok(prompts.astraInstructions.includes("update_intake"));

console.log("PASS voice-v3 astra tool contracts audit");
