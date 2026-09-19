/**
 * Real GPT Astra tool-selection cert for request_callback (requires OPENAI_API_KEY).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { VOICE_V3_SEND_LINK_TEST_CONFIG } from "./voice-v3-send-link-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

type Scenario = {
  label: string;
  config: typeof VOICE_V3_BOOKING_TEST_CONFIG;
  history: string;
  expectTool: string | null;
  forbiddenTools?: string[];
};

const CALLBACK_ON_BOOKING = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
  },
};

const SCENARIOS: Scenario[] = [
  {
    label: "callback_direct",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: Can somebody call me back about my water heater?",
    expectTool: "request_callback",
  },
  {
    label: "abandon_booking_for_callback",
    config: CALLBACK_ON_BOOKING,
    history:
      "Caller began booking and gave their name. Caller now says: I don't want to schedule anymore. Just have somebody contact me.",
    expectTool: "request_callback",
    forbiddenTools: ["book_appointment"],
  },
  {
    label: "abandon_send_link",
    config: {
      ...VOICE_V3_SEND_LINK_TEST_CONFIG,
      callHandling: {
        ...VOICE_V3_SEND_LINK_TEST_CONFIG.callHandling,
        callbackRequestsEnabled: true,
      },
    },
    history:
      "Caller asked to book. Before any SMS, caller says: Never mind, just have someone call me.",
    expectTool: "request_callback",
    forbiddenTools: ["send_booking_link"],
  },
  {
    label: "hours_not_callback",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: What time do you close today?",
    expectTool: null,
    forbiddenTools: ["request_callback"],
  },
  {
    label: "book_not_callback",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: I want to make an appointment for next Tuesday.",
    expectTool: "set_scheduling_preference",
    forbiddenTools: ["request_callback"],
  },
];

async function pickTool(scenario: Scenario): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log("SKIP voice-v3 astra callback selection (no OPENAI_API_KEY)");
    process.exit(0);
  }
  const client = new OpenAI({ apiKey });
  const tools = buildVoiceV3AstraFunctionTools(scenario.config);
  const prompts = buildVoiceV3Prompts(resolveVoiceV3DefaultPromptInput(scenario.config));
  const response = await client.responses.create({
    model: process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-4.1",
    input: [
      { role: "system", content: prompts.astraSystem },
      { role: "user", content: scenario.history },
    ],
    tools,
    tool_choice: "auto",
  });
  for (const item of response.output) {
    if (item.type === "function_call") return item.name;
  }
  return null;
}

async function main() {
  for (const scenario of SCENARIOS) {
    const picked = await pickTool(scenario);
    if (scenario.expectTool) {
      assert.equal(picked, scenario.expectTool, `${scenario.label} expected ${scenario.expectTool}`);
    }
    if (scenario.forbiddenTools?.length && picked) {
      assert.ok(
        !scenario.forbiddenTools.includes(picked),
        `${scenario.label} forbids ${scenario.forbiddenTools.join(",")} but got ${picked}`,
      );
    }
    console.log(`PASS astra_callback_selection:${scenario.label}:${picked ?? "none"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
