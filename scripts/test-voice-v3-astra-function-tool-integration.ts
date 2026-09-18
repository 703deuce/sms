/**
 * Delegated Responses strict function tool (emit_caller_meaning) — requires OPENAI_API_KEY.
 * Mirrors Live delegation.tools shape (not sessions.accept).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import { decodeCallerMeaningFromFunctionArguments } from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import { buildEmitCallerMeaningLiveFunctionTool } from "../src/lib/voice-v3/intake/emit-caller-meaning-tool";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "../src/lib/voice-v3/intake/emit-caller-meaning-tool";

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra function-tool integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const tool = buildEmitCallerMeaningLiveFunctionTool(TEST_AGENT_CONFIG);

  const response = await client.responses.create({
    model: "gpt-6-astra",
    input: [
      {
        role: "system",
        content:
          "Interpret the caller and call emit_caller_meaning once with strict arguments. Semantic only — no workflow fields.",
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
    tool_choice: { type: "function", name: EMIT_CALLER_MEANING_TOOL_NAME },
    parallel_tool_calls: false,
  });

  const output = response.output ?? [];
  const fnCall = output.find(
    (item) => item.type === "function_call" && item.name === EMIT_CALLER_MEANING_TOOL_NAME,
  );
  assert.ok(fnCall && fnCall.type === "function_call", "expected function_call in response.output");
  assert.equal(typeof fnCall.arguments, "string");

  const meaning = decodeCallerMeaningFromFunctionArguments(fnCall.arguments, TEST_AGENT_CONFIG);
  assert.ok(meaning);
  assert.equal(meaning!.captured_fields.find((r) => r.key === "name")?.value, "Anthony");

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
