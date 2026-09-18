/**
 * Live Astra multi-goal messy language (requires OPENAI_API_KEY).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildCallerInterpretationContext } from "../src/lib/voice-v3/intake/caller-meaning";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { buildAstraBackendInstructions } from "../src/lib/voice-v3/prompts/astra-backend-instructions";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { normalizeCallerGoals } from "../src/lib/voice-v3/intake/normalize-caller-goals";

const UTTERANCES = [
  {
    id: "cancel_and_book_messy",
    text:
      "Yeah I actually need to cancel the one I've got tomorrow, but if y'all got anything Friday afternoon I'd like to come in then instead.",
    expectGoalTypes: ["CANCEL_APPOINTMENT", "BOOK_APPOINTMENT"],
  },
  {
    id: "forget_friday_cancel_tomorrow",
    text: "Actually forget Friday, just cancel tomorrow.",
    expectGoalTypes: ["CANCEL_APPOINTMENT"],
  },
  {
    id: "cancel_and_book_next_week",
    text: "Cancel tomorrow and while I've got you, can you book another one sometime next week?",
    expectGoalTypes: ["CANCEL_APPOINTMENT", "BOOK_APPOINTMENT"],
  },
];

async function interpret(client: OpenAI, ctx: ReturnType<typeof createInitialVoiceV3CallContext>, utterance: string) {
  const textFormat = voiceV3CallerMeaningTextFormat(VOICE_V3_BOOKING_TEST_CONFIG);
  const instructions = buildAstraBackendInstructions({
    businessName: VOICE_V3_BOOKING_TEST_CONFIG.businessName,
    timezone: VOICE_V3_BOOKING_TEST_CONFIG.timezone,
    intakeTransport: "output_text",
    intakeFieldCatalog: VOICE_V3_BOOKING_TEST_CONFIG.intakeFields.map((f) => f.key).join(", "),
  });
  const contextJson = buildCallerInterpretationContext(VOICE_V3_BOOKING_TEST_CONFIG, ctx);
  const response = await client.responses.parse({
    model: "gpt-6-astra",
    input: [
      { role: "system", content: instructions },
      {
        role: "user",
        content: `Caller said: "${utterance}"\n\nContext:\n${JSON.stringify(contextJson)}`,
      },
    ],
    text: { format: textFormat },
  });
  const meaning = response.output_parsed;
  assert.ok(meaning, "output_parsed required");
  return meaning;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3-astra-multi-goal-live (no OPENAI_API_KEY)");
    process.exit(0);
  }

  const client = new OpenAI();
  const clock = buildVoiceV3CallClock(VOICE_V3_BOOKING_TEST_CONFIG.timezone);
  let ctx = createInitialVoiceV3CallContext({
    callId: "astra_mg_call",
    liveSessionId: "astra_mg_live",
    timezone: VOICE_V3_BOOKING_TEST_CONFIG.timezone,
    clock,
  });

  for (const caseRow of UTTERANCES) {
    const meaning = await interpret(client, ctx, caseRow.text);
    const goals = normalizeCallerGoals(meaning);
    const types = goals.map((g) => g.type);
    for (const expected of caseRow.expectGoalTypes) {
      assert.ok(
        types.includes(expected),
        `${caseRow.id}: expected goal ${expected} in ${JSON.stringify(types)}`,
      );
    }
    const applied = applyCallerMeaningToContext(ctx, VOICE_V3_BOOKING_TEST_CONFIG, meaning);
    ctx = applied.context;
    console.log("ASTRA_MULTI_GOAL_OK", caseRow.id, types.join("+"));
  }

  assert.equal(ctx.intake.values.name?.value ?? "", "");
  console.log("VOICE_V3_ASTRA_MULTI_GOAL_LIVE_PASS");
}

main().catch((e) => {
  console.error("VOICE_V3_ASTRA_MULTI_GOAL_LIVE_FAIL", e);
  process.exit(1);
});
