/**
 * Delegated Responses capability tool selection — requires OPENAI_API_KEY.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildUpdateIntakeOpenAiTool } from "../src/lib/voice-v3/tools/update-intake-tool";

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra function-tool integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const tool = buildUpdateIntakeOpenAiTool(VOICE_V3_BOOKING_TEST_CONFIG);

  const response = await client.responses.create({
    model: "gpt-6-astra",
    input: [
      {
        role: "system",
        content:
          "You are Amy's reasoning backend. When the caller shares contact details, call update_intake with strict arguments.",
      },
      {
        role: "user",
        content: 'Caller said: "My name is Anthony and my email is anthony@example.com."',
      },
    ],
    tools: [
      {
        type: "function",
        name: tool.name,
        description: tool.description ?? undefined,
        parameters: tool.parameters ?? {},
        strict: tool.strict ?? true,
      },
    ],
    tool_choice: { type: "function", name: "update_intake" },
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
