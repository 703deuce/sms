/**
 * Static audit: production Astra tool contracts (no live API).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

const tools = buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG);
const names = listVoiceV3AstraToolNamesForConfig(VOICE_V3_BOOKING_TEST_CONFIG);

assert.equal(tools.length, names.length);
for (const expected of ["find_appointment", "reschedule_appointment", "cancel_appointment"]) {
  assert.ok(names.includes(expected), `catalog must include ${expected}`);
}
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
assert.ok(!("active_goal" in updateProps), "update_intake must not expose active_goal");

const find = tools.find((t) => t.name === "find_availability")!;
const findProps = (find.parameters as { properties?: Record<string, unknown> }).properties ?? {};
assert.ok(!("date_expression" in findProps), "find_availability must not expose date_expression");
assert.ok(!("time_expression" in findProps), "find_availability must not expose time_expression");

const findAppt = tools.find((t) => t.name === "find_appointment")!;
const findApptProps = (findAppt.parameters as { properties?: Record<string, unknown> }).properties ?? {};
assert.ok("name" in findApptProps, "find_appointment must accept name");
assert.ok("confirm_selection" in findApptProps, "find_appointment must support confirm_selection");
assert.ok("time_expression" in findApptProps, "find_appointment must expose time_expression");
assert.ok("time_kind" in findApptProps, "find_appointment must expose semantic time_kind");
assert.ok(!("ani" in findApptProps), "find_appointment must not expose ani to the LLM");
assert.ok(findAppt.description?.includes("useful_discriminator"), "find_appointment description must explain discriminators");
assert.ok(findAppt.description?.includes("find_availability"), "find_appointment must distinguish from find_availability");

const setSched = tools.find((t) => t.name === "set_scheduling_preference")!;
assert.ok(setSched.description && setSched.description.includes("Do not calculate UTC"), "set_scheduling_preference description must forbid UTC calculation");

const prompts = buildVoiceV3Prompts({
  ...resolveVoiceV3DefaultPromptInput(new Date()),
  agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
});
assert.ok(prompts.astraInstructions.includes("Direct calendar booking"));
assert.ok(prompts.astraInstructions.includes("update_intake"));
assert.ok(prompts.astraInstructions.includes("set_scheduling_preference"));
assert.ok(
  prompts.astraInstructions.includes("FIND may occur while intake is still incomplete"),
  "cross-tool must allow FIND before full intake",
);
assert.ok(
  prompts.astraInstructions.includes("persist it with update_intake during the current delegated work"),
  "intake prompt persistence rule must ship in Astra instructions",
);

console.log("PASS voice-v3 astra tool contracts audit");
