/**
 * Real Astra intake tool-selection certification (requires OPENAI_API_KEY).
 * Extends production tool-selection matrix with multi-field intake scenarios.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

type Scenario = {
  label: string;
  history: string;
  expectTools: string[];
  forbiddenTools?: string[];
  expectIntakeKeys?: string[];
};

const SCENARIOS: Scenario[] = [
  {
    label: "case1_name_only",
    history: "Caller: I'm Anthony Johnson.",
    expectTools: ["update_intake"],
    expectIntakeKeys: ["name"],
    forbiddenTools: ["find_availability"],
  },
  {
    label: "case2_name_and_email",
    history:
      "Caller: My name is Anthony Johnson and my email is anthony@example.com.",
    expectTools: ["update_intake"],
    expectIntakeKeys: ["name", "email"],
  },
  {
    label: "case5_scheduling_only",
    history: "Caller: Tuesday afternoon works best.",
    expectTools: ["find_availability"],
    forbiddenTools: ["update_intake"],
  },
  {
    label: "case6_intake_plus_find",
    history:
      "Caller: I'm Anthony Johnson and what do you have Tuesday afternoon?",
    // parallel_tool_calls is off in production — intake may arrive in first delegation; FIND may follow.
    expectTools: ["update_intake"],
    expectIntakeKeys: ["name"],
  },
  {
    label: "case8_incomplete_email",
    history: "Caller: Uh, my email is Anthony at… hold on.",
    expectTools: [],
    forbiddenTools: ["update_intake"],
  },
];

async function runScenario(client: OpenAI, scenario: Scenario) {
  const tools = buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG);
  const prompts = buildVoiceV3Prompts({
    ...resolveVoiceV3DefaultPromptInput(new Date()),
    agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
  });

  const response = await client.responses.create({
    model: process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-6-astra",
    instructions: prompts.astraInstructions,
    input: [
      {
        role: "user",
        content: `Recent call context for tool selection only:\n${scenario.history}`,
      },
    ],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
  });

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const item of response.output ?? []) {
    if (item.type === "function_call") {
      calls.push({
        name: item.name,
        args: JSON.parse(item.arguments || "{}") as Record<string, unknown>,
      });
    }
  }

  const names = calls.map((c) => c.name);
  for (const expected of scenario.expectTools) {
    assert.ok(names.includes(expected), `${scenario.label}: expected tool ${expected}, got ${names.join(",")}`);
  }
  for (const forbidden of scenario.forbiddenTools ?? []) {
    assert.ok(!names.includes(forbidden), `${scenario.label}: must not call ${forbidden}`);
  }

  if (scenario.expectIntakeKeys?.length) {
    const intake = calls.find((c) => c.name === "update_intake");
    assert.ok(intake, `${scenario.label}: expected update_intake`);
    for (const key of scenario.expectIntakeKeys) {
      const v = intake.args[key];
      assert.ok(
        typeof v === "string" && v.trim().length > 0,
        `${scenario.label}: expected ${key} in update_intake`,
      );
    }
  }

  console.log(`PASS ${scenario.label}`, names);
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra intake cert (no OPENAI_API_KEY)");
    return;
  }
  const client = new OpenAI();
  for (const scenario of SCENARIOS) {
    await runScenario(client, scenario);
  }
  console.log("PASS voice-v3 astra intake cert");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
