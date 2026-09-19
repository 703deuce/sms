/**
 * Real Astra tool-selection certification (requires OPENAI_API_KEY).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildAstraBackendInstructions } from "../src/lib/voice-v3/prompts/astra-backend-instructions";

type Scenario = {
  label: string;
  history: string;
  expectTool: string | null;
  expectSlotId?: string;
};

const SCENARIOS: Scenario[] = [
  {
    label: "availability",
    history:
      "Amy already greeted the caller. Caller: What appointment times do you have open Tuesday afternoon? The caller is not providing contact details — they want calendar availability.",
    expectTool: "find_availability",
  },
  {
    label: "booking",
    history:
      "Amy presented three slots from offer_set_id offer_demo: slot_1 at 1:00 PM, slot_2 at 2:30 PM, slot_3 at 4:00 PM. Caller: I'll take the second one — book that slot.",
    expectTool: "book_appointment",
    expectSlotId: "slot_2",
  },
  {
    label: "correction",
    history:
      "Caller previously asked about Monday afternoon but now says: Actually forget Monday — check Tuesday afternoon instead.",
    expectTool: "find_availability",
  },
  {
    label: "reschedule",
    history:
      "Caller: I need to reschedule my existing appointment to another day. They are not asking for new availability yet — locate the current appointment record first using find_appointment.",
    expectTool: "find_appointment",
  },
  {
    label: "cancel",
    history:
      "Caller: I need to cancel my existing appointment tomorrow. Locate the appointment first before any cancellation mutation.",
    expectTool: "find_appointment",
  },
  {
    label: "no_tool_small_talk",
    history: "Caller: Nice weather today, isn't it? (No booking, scheduling, or account request.)",
    expectTool: null,
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra tool-selection cert (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const tools = buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG).map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? undefined,
    parameters: t.parameters ?? {},
    strict: t.strict ?? true,
  }));
  const instructions = buildAstraBackendInstructions({
    businessName: "Acme",
    timezone: "America/New_York",
    currentLocalDateTime: "Friday, September 18, 2026 at 1:00 PM EDT",
    toolSurface: "capability_tools",
  });

  for (const scenario of SCENARIOS) {
    const response = await client.responses.create({
      model: "gpt-6-astra",
      instructions,
      input: [{ role: "user", content: scenario.history }],
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
    });
    const calls = (response.output ?? []).filter((o) => o.type === "function_call") as Array<{
      type: string;
      name?: string;
      arguments?: string;
    }>;

    if (scenario.expectTool === null) {
      assert.equal(calls.length, 0, `${scenario.label}: expected no tool call`);
      continue;
    }
    assert.ok(calls.length >= 1, `${scenario.label}: expected a tool call`);
    const first = calls[0];
    assert.equal(first.type, "function_call");
    assert.equal(first.name, scenario.expectTool, `${scenario.label}: wrong tool`);
    if (scenario.expectSlotId && first.type === "function_call") {
      const args = JSON.parse(first.arguments) as { slot_id?: string };
      assert.equal(args.slot_id, scenario.expectSlotId);
    }
    console.log("ASTRA_TOOL_SELECTION_OK", { scenario: scenario.label, tool: first.name });
  }

  console.log("PASS voice-v3 astra tool-selection cert");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra tool-selection cert", err);
  process.exit(1);
});
