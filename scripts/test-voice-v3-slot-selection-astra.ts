/**
 * Astra semantic slot selection + deterministic resolver (requires OPENAI_API_KEY).
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildEmitCallerMeaningLiveFunctionTool } from "../src/lib/voice-v3/intake/emit-caller-meaning-tool";
import { decodeCallerMeaningFromFunctionArguments } from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import { recordPresentedOffer } from "../src/lib/voice-v3/calendar/presentation";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";

const TZ = "America/New_York";

function miniOffer(): AvailabilityOfferSet {
  const slots = [
    {
      slotId: "slot_1",
      startUtc: "2026-09-25T17:00:00.000Z",
      endUtc: "2026-09-25T18:00:00.000Z",
      localStart: "2026-09-25T13:00:00-04:00",
      localEnd: "2026-09-25T14:00:00-04:00",
    },
    {
      slotId: "slot_2",
      startUtc: "2026-09-25T18:30:00.000Z",
      endUtc: "2026-09-25T19:30:00.000Z",
      localStart: "2026-09-25T14:30:00-04:00",
      localEnd: "2026-09-25T15:30:00-04:00",
    },
    {
      slotId: "slot_3",
      startUtc: "2026-09-25T20:00:00.000Z",
      endUtc: "2026-09-25T21:00:00.000Z",
      localStart: "2026-09-25T16:00:00-04:00",
      localEnd: "2026-09-25T17:00:00-04:00",
    },
  ];
  return {
    offerSetId: "offer_astra",
    schedulingGeneration: 3,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: slots.map((s) => s.slotId),
    slots,
  };
}

async function interpret(client: OpenAI, phrase: string) {
  const tool = buildEmitCallerMeaningLiveFunctionTool(VOICE_V3_BOOKING_TEST_CONFIG);
  const response = await client.responses.create({
    model: "gpt-6-astra",
    input: [
      {
        role: "system",
        content:
          "Extract caller meaning including slot_selection when the caller is choosing an appointment time. Use semantic slot_selection only — never slotId or offerSetId. Presented times: 1:00 PM (slot_1), 2:30 PM (slot_2), 4:00 PM (slot_3). Ordinal 'second one' = ordinal 2.",
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
    tool_choice: { type: "function", name: "emit_caller_meaning" },
    parallel_tool_calls: false,
  });
  const fn = response.output?.find((o) => o.type === "function_call");
  assert.ok(fn && fn.type === "function_call");
  const meaning = decodeCallerMeaningFromFunctionArguments(fn.arguments, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.ok(meaning);
  return meaning!;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("SKIP voice-v3 slot-selection astra integration (no OPENAI_API_KEY)");
    return;
  }

  const client = new OpenAI();
  const offer = miniOffer();
  const presented = recordPresentedOffer({
    offerSet: offer,
    presentedSlotIds: ["slot_1", "slot_2", "slot_3"],
  });
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "astra_sel",
    liveSessionId: "live_astra_sel",
    timezone: TZ,
    clock,
  });
  ctx = {
    ...ctx,
    scheduling: { generation: 3, normalized: null },
    availability: { ...ctx.availability, status: "ready", activeOfferSet: offer },
    presentation: { current: presented },
  };

  const m1 = await interpret(client, "2:30 sounds good.");
  assert.notEqual(m1.slot_selection.selection_type, "NONE");
  let applied = applySlotSelectionFromMeaning(ctx, m1.slot_selection);
  assert.equal(applied.context.selection.selected?.slotId, "slot_2");

  const m2 = await interpret(client, "I'll take the second one.");
  applied = applySlotSelectionFromMeaning(ctx, m2.slot_selection);
  assert.equal(applied.context.selection.selected?.slotId, "slot_2");

  const m3 = await interpret(client, "Actually let's do four.");
  applied = applySlotSelectionFromMeaning(applied.context, m3.slot_selection);
  assert.equal(applied.context.selection.selected?.slotId, "slot_3");

  const m4 = await interpret(client, "Can we do three instead?");
  applied = applySlotSelectionFromMeaning(applied.context, m4.slot_selection);
  assert.notEqual(applied.resolution?.status, "RESOLVED", "3:00 was not offered");
  assert.equal(applied.context.selection.selected?.slotId, "slot_3", "prior 4:00 selection unchanged");

  const mBad = await interpret(client, "Let's do 3:00.");
  applied = applySlotSelectionFromMeaning(applied.context, mBad.slot_selection);
  if (applied.resolution?.status === "RESOLVED") {
    assert.notEqual(applied.context.selection.selected?.slotId, "slot_2", "must not pick nearby slot");
  } else {
    assert.notEqual(applied.resolution?.status, "RESOLVED");
  }

  void emptySchedulingMeaning();
  void emptySlotSelectionMeaning();

  console.log("PASS voice-v3 slot-selection astra integration");
}

main().catch((err) => {
  console.error("FAIL voice-v3 slot-selection astra integration", err);
  process.exit(1);
});
