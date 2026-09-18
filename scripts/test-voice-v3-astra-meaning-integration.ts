/**
 * Live GPT-6 Astra Structured Output integration (requires OPENAI_API_KEY).
 * Uses Responses API: text.format = zodTextFormat(buildCallerMeaningZodSchema(config), ...).
 * Typed result: ParsedResponse.output_parsed (openai@^7.17.0 responses.d.ts).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildCallerInterpretationContext } from "../src/lib/voice-v3/intake/caller-meaning";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";

const PHRASES = [
  "My name is Anthony.",
  "Email is anthony@example.com.",
  "My phone number is 555-123-4567.",
  "I need an appointment next Friday afternoon.",
];

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const clock = buildVoiceV3CallClock(VOICE_V3_BOOKING_TEST_CONFIG.timezone);
  let ctx = createInitialVoiceV3CallContext({
    callId: "integration_call",
    liveSessionId: "live_integration",
    timezone: VOICE_V3_BOOKING_TEST_CONFIG.timezone,
    clock,
  });

  const textFormat = voiceV3CallerMeaningTextFormat(VOICE_V3_BOOKING_TEST_CONFIG);

  for (const phrase of PHRASES) {
    const contextJson = buildCallerInterpretationContext(VOICE_V3_BOOKING_TEST_CONFIG, ctx);
    const response = await client.responses.parse({
      model: "gpt-6-astra",
      input: [
        {
          role: "system",
          content:
            "Extract caller meaning as strict JSON only. Use configured field keys only. Corrections override prior values for the same key.",
        },
        {
          role: "user",
          content: `Caller said: "${phrase}"\n\nContext:\n${JSON.stringify(contextJson)}`,
        },
      ],
      text: {
        format: textFormat,
      },
    });

    const meaning = response.output_parsed;
    assert.ok(meaning, "expected response.output_parsed from responses.parse");

    const applied = applyCallerMeaningToContext(ctx, VOICE_V3_BOOKING_TEST_CONFIG, meaning);
    ctx = applied.context;
  }

  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.ok(ctx.intake.values.email?.value?.includes("anthony"));
  assert.ok(ctx.intake.values.phone?.value?.replace(/\D/g, "").includes("5551234567"));
  assert.ok(
    ctx.scheduling.meaning?.weekday === "FRIDAY" ||
      ctx.scheduling.meaning?.daypart === "AFTERNOON" ||
      ctx.scheduling.normalized?.localDate?.includes("-"),
  );

  const rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(rules.missingRequiredFields.length, 0);

  console.log("PASS voice-v3 astra structured output integration (output_parsed)");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra integration", err);
  process.exit(1);
});
