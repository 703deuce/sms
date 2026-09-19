/**
 * Delegated Responses capability tool selection — requires OPENAI_API_KEY.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra function-tool integration (no OPENAI_API_KEY)");
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

  const response = await client.responses.create({
    model: "gpt-6-astra",
    instructions: astraInstructions,
    input: [
      {
        role: "user",
        content:
          'Caller said: "My name is Anthony and my email is anthony@example.com." (Not asking about calendar times.)',
      },
    ],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
  });

  const output = response.output ?? [];
  const fnCall = output.find(
    (item) => item.type === "function_call" && item.name === "update_intake",
  );
  assert.ok(fnCall && fnCall.type === "function_call", "expected update_intake function_call");
  assert.equal(typeof fnCall.arguments, "string");
  const args = JSON.parse(fnCall.arguments) as Record<string, unknown>;
  assert.equal(args.name, "Anthony");
  assert.equal(args.email, "anthony@example.com");

  console.log("PASS voice-v3 astra function-tool integration", {
    nested_event_shape: {
      output_item_type: fnCall.type,
      name: fnCall.name,
      arguments_bytes: fnCall.arguments.length,
    },
  });
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra function-tool integration", err);
  process.exit(1);
});
