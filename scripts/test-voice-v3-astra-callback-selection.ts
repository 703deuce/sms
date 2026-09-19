/**
 * Real GPT-6 Astra tool-selection certification for request_callback.
 * Requires OPENAI_API_KEY. Uses production Astra model (gpt-6-astra).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { VOICE_V3_SEND_LINK_TEST_CONFIG } from "./voice-v3-send-link-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

const MODEL = process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-6-astra";

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

const TRANSFER_ON = {
  ...CALLBACK_ON_BOOKING,
  capabilities: {
    ...CALLBACK_ON_BOOKING.capabilities,
    transferCalls: true,
  },
  transferDestinations: [
    { id: "front_desk", label: "Front desk", phoneE164: "+15559876543", enabled: true },
  ],
};

const SCENARIOS: Scenario[] = [
  {
    label: "A_can_somebody_call_me_back",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: Can you have somebody call me back?",
    expectTool: "request_callback",
  },
  {
    label: "B_office_give_me_a_call",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: I need someone from the office to give me a call.",
    expectTool: "request_callback",
  },
  {
    label: "C_forget_appointment_callback",
    config: CALLBACK_ON_BOOKING,
    history:
      "Caller was booking an appointment and gave their name. Caller now says: Actually forget the appointment. Just have someone call me.",
    expectTool: "request_callback",
    forbiddenTools: ["book_appointment", "find_availability"],
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
      "Caller asked to book online. Before any text, caller says: Never mind, just have someone call me.",
    expectTool: "request_callback",
    forbiddenTools: ["send_booking_link"],
  },
  {
    label: "callback_later_human",
    config: CALLBACK_ON_BOOKING,
    history:
      "Caller: I need to speak to someone but they can call me later this afternoon.",
    expectTool: "request_callback",
  },
  {
    label: "G_hours_not_callback",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: What time do you close?",
    expectTool: null,
    forbiddenTools: ["request_callback"],
  },
  {
    label: "D_book_monday_not_callback",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: Can I book something for Monday?",
    expectTool: "set_scheduling_preference",
    forbiddenTools: ["request_callback"],
  },
  {
    label: "E_text_booking_link_not_callback",
    config: {
      ...VOICE_V3_SEND_LINK_TEST_CONFIG,
      callHandling: {
        ...VOICE_V3_SEND_LINK_TEST_CONFIG.callHandling,
        callbackRequestsEnabled: true,
      },
    },
    history:
      "Amy read the required SMS disclosure for the booking link. Caller agreed to receive the text. Caller: Can you text me the booking link?",
    expectTool: "send_booking_link",
    forbiddenTools: ["request_callback"],
  },
  {
    label: "H_callback_insufficient_facts_still_select",
    config: CALLBACK_ON_BOOKING,
    history:
      "Caller: Please have someone call me back about my issue. They have not given their name or any other details yet.",
    expectTool: "request_callback",
  },
  {
    label: "cancel_not_callback",
    config: CALLBACK_ON_BOOKING,
    history: "Caller: I want to cancel my appointment tomorrow.",
    expectTool: "find_appointment",
    forbiddenTools: ["request_callback"],
  },
  {
    label: "F_transfer_now_not_callback",
    config: TRANSFER_ON,
    history: "Caller: Can you transfer me to somebody right now?",
    expectTool: "transfer_call",
    forbiddenTools: ["request_callback"],
  },
];

async function pickTool(scenario: Scenario): Promise<string | null> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools = buildVoiceV3AstraFunctionTools(scenario.config).map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? undefined,
    parameters: t.parameters ?? {},
    strict: t.strict ?? true,
  }));
  const { astraInstructions } = buildVoiceV3Prompts({
    ...resolveVoiceV3DefaultPromptInput(new Date(), scenario.config),
  });
  const response = await client.responses.create({
    model: MODEL,
    instructions: astraInstructions,
    input: [{ role: "user", content: scenario.history }],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
  });
  for (const item of response.output) {
    if (item.type === "function_call") return item.name;
  }
  return null;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("FAIL: OPENAI_API_KEY required for Astra callback selection cert");
    process.exit(1);
  }

  console.log(`ASTRA_CALLBACK_SELECTION model=${MODEL}`);
  const results: Array<{ label: string; picked: string | null; ok: boolean }> = [];

  for (const scenario of SCENARIOS) {
    const picked = await pickTool(scenario);
    let ok = true;
    if (scenario.expectTool) {
      ok = picked === scenario.expectTool;
    }
    if (scenario.forbiddenTools?.length && picked) {
      ok = ok && !scenario.forbiddenTools.includes(picked);
    }
    if (scenario.expectTool === null && scenario.forbiddenTools?.includes("request_callback")) {
      ok = picked !== "request_callback";
    }
    results.push({ label: scenario.label, picked, ok });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${scenario.label} picked=${picked ?? "none"} expected=${scenario.expectTool ?? "none/forbidden"}`,
    );
    if (!ok) {
      process.exitCode = 1;
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`ASTRA_CALLBACK_SELECTION failed=${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`ASTRA_CALLBACK_SELECTION_PASS ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
