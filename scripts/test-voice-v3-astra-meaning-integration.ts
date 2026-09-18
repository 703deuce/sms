/**
 * Live GPT-6 Astra Structured Output integration (requires OPENAI_API_KEY).
 * Uses Responses API: text.format = zodTextFormat(buildCallerMeaningZodSchema(config), ...).
 * Typed result: ParsedResponse.output_parsed (openai@^7.17.0 responses.d.ts).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import { buildCallerInterpretationContext } from "../src/lib/voice-v3/intake/caller-meaning";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";

const PHRASES = [
  "My name is Anthony.",
  "My mother's name is Mary.",
  "Favorite dinosaur? Probably a velociraptor.",
  "Actually, her name is Maria.",
  "I need an appointment next Friday afternoon.",
];

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const clock = buildVoiceV3CallClock(TEST_AGENT_CONFIG.timezone);
  let ctx = createInitialVoiceV3CallContext({
    callId: "integration_call",
    liveSessionId: "live_integration",
    timezone: TEST_AGENT_CONFIG.timezone,
    clock,
  });

  const textFormat = voiceV3CallerMeaningTextFormat(TEST_AGENT_CONFIG);

  for (const phrase of PHRASES) {
    const contextJson = buildCallerInterpretationContext(TEST_AGENT_CONFIG, ctx);
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

    const applied = applyCallerMeaningToContext(ctx, TEST_AGENT_CONFIG, meaning);
    ctx = applied.context;
  }

  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.equal(ctx.intake.values.mothers_name?.value, "Maria");
  assert.ok(ctx.intake.values.favorite_dinosaur?.value?.toLowerCase().includes("velociraptor"));
  assert.ok(
    ctx.scheduling.requestedDateExpression?.toLowerCase().includes("friday") ||
      ctx.scheduling.requestedDaypart?.toLowerCase().includes("afternoon"),
  );

  const rules = evaluateVoiceV3Rules(ctx, TEST_AGENT_CONFIG);
  assert.equal(rules.missingRequiredFields.includes("email"), true);

  console.log("PASS voice-v3 astra structured output integration (output_parsed)");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra integration", err);
  process.exit(1);
});
