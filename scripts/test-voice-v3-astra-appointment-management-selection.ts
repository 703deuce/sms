/**
 * Real GPT-6 Astra tool-selection cert for appointment management (final tool contracts).
 * Requires OPENAI_API_KEY.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

const MODEL = process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-6-astra";

type Scenario = {
  id: string;
  history: string;
  expectTool: string | null;
  forbiddenTools?: string[];
  expectArgKeys?: string[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "A_find_unknown_appointment",
    history:
      "Caller: I need to cancel my appointment, but I don't remember when it is.",
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment"],
  },
  {
    id: "B_phone_discriminator_followup",
    history: `Caller: I need to cancel my appointment.
Tool result: find_appointment returned needs_more_information with useful_discriminators=["phone"].
Caller has not given a phone number yet.`,
    expectTool: null,
    forbiddenTools: ["cancel_appointment"],
  },
  {
    id: "C_email_discriminator_followup",
    history: `Tool result: find_appointment returned needs_more_information with useful_discriminators=["email"].
Caller has not given email yet.`,
    expectTool: null,
    forbiddenTools: ["cancel_appointment"],
  },
  {
    id: "D_identity_confirm_not_cancel",
    history: `find_appointment already returned needs_confirmation for Monday 10 AM plumbing.
Caller: Yes, that's my Monday appointment. (They have NOT asked to cancel.)`,
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment"],
  },
  {
    id: "E_explicit_cancel",
    history: `The exact appointment is already confirmed in state.
Caller: Yes, cancel that appointment please.`,
    expectTool: "cancel_appointment",
  },
  {
    id: "F_reschedule_sequence",
    history:
      "Caller: I need to move my appointment to Wednesday afternoon. No replacement slot chosen yet.",
    expectTool: "find_appointment",
    forbiddenTools: ["reschedule_appointment"],
  },
  {
    id: "G_lookup_only",
    history: "Caller: What time is my appointment?",
    expectTool: "find_appointment",
    forbiddenTools: ["cancel_appointment", "reschedule_appointment"],
  },
  {
    id: "H_multiple_appointments",
    history: `find_appointment returned ambiguous with two candidates for the same customer (Monday diagnostic vs Thursday installation).
Caller has not picked which one.`,
    expectTool: null,
    forbiddenTools: ["cancel_appointment", "reschedule_appointment"],
  },
  {
    id: "I_time_only_clue",
    history:
      "Caller: I don't remember what day it is, but I think my appointment is at 10 AM.",
    expectTool: "find_appointment",
    expectArgKeys: ["time_kind", "exact_time"],
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra appointment-management selection (no OPENAI_API_KEY)");
    console.log("REAL_ASTRA_TOOL_SELECTION_CERT=NOT_RUN");
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
      model: MODEL,
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
      assert.equal(calls.length, 0, `${scenario.id}: expected no tool call`);
    } else {
      assert.ok(calls.length >= 1, `${scenario.id}: expected a tool call`);
      assert.equal(calls[0]!.name, scenario.expectTool, `${scenario.id}: wrong tool`);
    }
    if (scenario.forbiddenTools) {
      for (const forbidden of scenario.forbiddenTools) {
        assert.ok(!calls.some((c) => c.name === forbidden), `${scenario.id}: must not call ${forbidden}`);
      }
    }
    if (scenario.expectArgKeys?.length && calls[0]?.arguments) {
      const args = JSON.parse(calls[0].arguments) as Record<string, unknown>;
      for (const key of scenario.expectArgKeys) {
        assert.ok(key in args, `${scenario.id}: missing arg ${key}`);
      }
    }
    console.log("ASTRA_APPT_MGMT_OK", { id: scenario.id, tool: calls[0]?.name ?? null });
  }

  console.log("PASS voice-v3 astra appointment-management selection");
  console.log(`REAL_ASTRA_MODEL=${MODEL}`);
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra appointment-management selection", err);
  process.exit(1);
});
