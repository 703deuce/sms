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
import { normalizeSchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-normalizer";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";

const FROZEN = new Date("2026-09-17T14:00:00.000Z");

const INTAKE_PHRASES = [
  "My name is Anthony.",
  "My mother's name is Mary.",
  "Favorite dinosaur? Probably a velociraptor.",
  "Actually, her name is Maria.",
];

const SCHEDULING_PHRASES = [
  { phrase: "I need something tomorrow afternoon.", expectLocalDate: "2026-09-18" },
  { phrase: "How about next Friday?", expectLocalDate: "2026-09-25" },
];

async function parsePhrase(
  client: OpenAI,
  textFormat: ReturnType<typeof voiceV3CallerMeaningTextFormat>,
  phrase: string,
  ctxJson: object,
): Promise<CallerMeaning> {
  const response = await client.responses.parse({
    model: "gpt-6-astra",
    input: [
      {
        role: "system",
        content:
          "Extract caller meaning as strict JSON only. Use configured field keys only. Corrections override prior values for the same key. Use supplied business_timezone and current_local_* for scheduling language. Return semantic scheduling only (no Graph/UTC fields). Use 24h HH:mm for times when confident.",
      },
      {
        role: "user",
        content: `Caller said: "${phrase}"\n\nContext:\n${JSON.stringify(ctxJson)}`,
      },
    ],
    text: { format: textFormat },
  });
  const meaning = response.output_parsed;
  assert.ok(meaning, "expected response.output_parsed from responses.parse");
  return meaning;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 astra integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const clock = buildVoiceV3CallClock(TEST_AGENT_CONFIG.timezone, FROZEN);
  let ctx = createInitialVoiceV3CallContext({
    callId: "integration_call",
    liveSessionId: "live_integration",
    timezone: TEST_AGENT_CONFIG.timezone,
    clock,
  });

  const textFormat = voiceV3CallerMeaningTextFormat(TEST_AGENT_CONFIG);

  for (const phrase of INTAKE_PHRASES) {
    const meaning = await parsePhrase(
      client,
      textFormat,
      phrase,
      buildCallerInterpretationContext(TEST_AGENT_CONFIG, ctx),
    );
    ctx = applyCallerMeaningToContext(ctx, TEST_AGENT_CONFIG, meaning).context;
  }

  for (const row of SCHEDULING_PHRASES) {
    const meaning = await parsePhrase(
      client,
      textFormat,
      row.phrase,
      buildCallerInterpretationContext(TEST_AGENT_CONFIG, ctx),
    );
    const normalized = normalizeSchedulingMeaning(meaning.scheduling, ctx.clock);
    assert.equal(
      normalized.localDate,
      row.expectLocalDate,
      `normalizer mismatch for: ${row.phrase}`,
    );
    ctx = applyCallerMeaningToContext(ctx, TEST_AGENT_CONFIG, meaning).context;
  }

  const correctionMeaning = await parsePhrase(
    client,
    textFormat,
    "Actually make that Thursday morning.",
    buildCallerInterpretationContext(TEST_AGENT_CONFIG, ctx),
  );
  const correctionNormalized = normalizeSchedulingMeaning(
    correctionMeaning.scheduling,
    ctx.clock,
  );
  if (correctionNormalized.precision === "UNRESOLVED") {
    assert.ok(
      correctionMeaning.ambiguities.length > 0 ||
        correctionMeaning.scheduling.date_relation === "UNSPECIFIED",
      "expected ambiguity signal when Thursday correction is unresolved",
    );
  } else {
    assert.equal(correctionNormalized.localDate, "2026-09-17");
  }
  ctx = applyCallerMeaningToContext(ctx, TEST_AGENT_CONFIG, correctionMeaning).context;

  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.equal(ctx.intake.values.mothers_name?.value, "Maria");
  assert.ok(ctx.intake.values.favorite_dinosaur?.value?.toLowerCase().includes("velociraptor"));
  assert.ok(ctx.scheduling.generation >= 2);

  const rules = evaluateVoiceV3Rules(ctx, TEST_AGENT_CONFIG);
  assert.equal(rules.missingRequiredFields.includes("email"), true);

  console.log("PASS voice-v3 astra structured output integration (output_parsed + normalizer)");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra integration", err);
  process.exit(1);
});
