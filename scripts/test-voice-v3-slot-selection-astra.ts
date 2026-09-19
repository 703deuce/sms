/**
 * Astra chooses book_appointment with stable offer_set_id / slot_id (requires OPENAI_API_KEY).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildBookAppointmentOpenAiTool } from "../src/lib/voice-v3/tools/book-appointment-tool";

async function interpretBook(client: OpenAI, phrase: string) {
  const tool = buildBookAppointmentOpenAiTool(VOICE_V3_BOOKING_TEST_CONFIG);
  const response = await client.responses.create({
    model: "gpt-6-astra",
    input: [
      {
        role: "system",
        content:
          "Caller is choosing an appointment slot. Offer set id is offer_astra. Slots: slot_1 at 1:00 PM, slot_2 at 2:30 PM, slot_3 at 4:00 PM. Call book_appointment with the matching slot_id when the caller picks a time. 'Second one' means slot_2.",
      },
      { role: "user", content: `Caller said: "${phrase}"` },
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
    tool_choice: { type: "function", name: "book_appointment" },
    parallel_tool_calls: false,
  });
  const fn = response.output?.find((o) => o.type === "function_call");
  assert.ok(fn && fn.type === "function_call");
  return JSON.parse(fn.arguments) as { offer_set_id: string; slot_id: string };
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 slot-selection astra integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const m1 = await interpretBook(client, "2:30 sounds good.");
  assert.equal(m1.slot_id, "slot_2");

  const m2 = await interpretBook(client, "I'll take the second one.");
  assert.equal(m2.slot_id, "slot_2");

  console.log("PASS voice-v3 slot-selection astra integration");
}

main().catch((err) => {
  console.error("FAIL voice-v3 slot-selection astra integration", err);
  process.exit(1);
});
