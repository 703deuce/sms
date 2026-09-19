/**
 * Real Astra tool-selection certification against production tool contracts + prompts.
 * Requires OPENAI_API_KEY. Certifies the interface we ship — not vague tool guessing.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

type Scenario = {
  label: string;
  category: string;
  history: string;
  expectTool: string | null;
  forbiddenTools?: string[];
  expectSlotId?: string;
};

const SCENARIOS: Scenario[] = [
  {
    category: "obvious",
    label: "availability",
    history:
      "Amy greeted the caller. Caller: What appointment times do you have open Tuesday afternoon?",
    expectTool: "find_availability",
    forbiddenTools: ["update_intake", "book_appointment"],
  },
  {
    category: "obvious",
    label: "intake_contact",
    history:
      'Caller: My name is Anthony Davis and my email is anthony@example.com. They are not asking about calendar times yet.',
    expectTool: "update_intake",
    forbiddenTools: ["find_availability"],
  },
  {
    category: "obvious",
    label: "booking",
    history:
      "Tool result already on record: find_availability returned offer_set_id=offer_demo with slot_1 (1:00 PM), slot_2 (2:30 PM), slot_3 (4:00 PM). Required intake is complete. Caller: Please book slot_2 — the 2:30 PM time.",
    expectTool: "book_appointment",
    expectSlotId: "slot_2",
  },
  {
    category: "obvious",
    label: "reschedule_lookup",
    history:
      "Caller: I need to reschedule my existing appointment. No new time chosen yet — locate my current appointment first.",
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment", "reschedule_appointment", "find_availability"],
  },
  {
    category: "obvious",
    label: "cancel_lookup",
    history:
      "Caller: I want to cancel my appointment tomorrow. They have not confirmed cancellation yet — find the appointment record first.",
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment"],
  },
  {
    category: "boundary",
    label: "availability_not_intake",
    history:
      "Caller: Do you have anything open Friday morning? (No name, email, or phone provided.)",
    expectTool: "find_availability",
    forbiddenTools: ["update_intake"],
  },
  {
    category: "boundary",
    label: "intake_not_availability",
    history: 'Caller: My phone number is 555-0100. (No scheduling question.)',
    expectTool: "update_intake",
    forbiddenTools: ["find_availability"],
  },
  {
    category: "correction",
    label: "scheduling_correction",
    history:
      "Caller previously asked about Monday afternoon but now says: Actually forget Monday — check Tuesday afternoon instead.",
    expectTool: "find_availability",
    forbiddenTools: ["update_intake"],
  },
  {
    category: "cancel_boundary",
    label: "cancel_not_before_find",
    history:
      "Caller: Yes, please cancel it — I am sure. (No find_appointment has been run in this call yet.)",
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment"],
  },
  {
    category: "multi_intent",
    label: "intake_then_availability_first_tool",
    history:
      "Caller: I'm Sarah, sarah@example.com — what do you have Thursday afternoon?",
    expectTool: "update_intake",
    forbiddenTools: ["book_appointment"],
  },
  {
    category: "no_tool",
    label: "small_talk",
    history: "Caller: Nice weather today. (No business request.)",
    expectTool: null,
  },
  {
    category: "transfer",
    label: "human_transfer",
    history: "Caller: I need to speak to a real person right now.",
    expectTool: "transfer_call",
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
  const { astraInstructions } = buildVoiceV3Prompts({
    ...resolveVoiceV3DefaultPromptInput(new Date()),
    agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
  });

  for (const scenario of SCENARIOS) {
    const response = await client.responses.create({
      model: "gpt-6-astra",
      instructions: astraInstructions,
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
      console.log("ASTRA_TOOL_SELECTION_OK", { category: scenario.category, scenario: scenario.label, tool: null });
      continue;
    }
    assert.ok(calls.length >= 1, `${scenario.label}: expected a tool call`);
    const first = calls[0];
    assert.equal(first.type, "function_call");
    assert.equal(first.name, scenario.expectTool, `${scenario.label}: wrong tool`);
    if (scenario.forbiddenTools) {
      for (const forbidden of scenario.forbiddenTools) {
        assert.ok(
          !calls.some((c) => c.name === forbidden),
          `${scenario.label}: must not call ${forbidden}`,
        );
      }
    }
    if (scenario.expectSlotId && first.type === "function_call") {
      const args = JSON.parse(first.arguments ?? "{}") as { slot_id?: string };
      assert.equal(args.slot_id, scenario.expectSlotId);
    }
    console.log("ASTRA_TOOL_SELECTION_OK", {
      category: scenario.category,
      scenario: scenario.label,
      tool: first.name,
    });
  }

  console.log("PASS voice-v3 astra tool-selection cert (production contracts)");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra tool-selection cert", err);
  process.exit(1);
});
