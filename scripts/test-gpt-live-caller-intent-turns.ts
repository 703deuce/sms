/**
 * Regression: per-turn caller intent layer (no CALLBACK from soft signals).
 */
import { interpretCallerUtterance, applyCallerIntentToCallContext } from "../src/lib/voice-receptionist-wizard/caller-intent-interpreter";
import { defaultVoiceV2DialogState } from "../src/lib/voice-receptionist-wizard/dialog-goal";
import { defaultVoiceV2BookingWorkflow, deriveVoiceV2NextStage } from "../src/lib/voice-receptionist-wizard/booking-workflow";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";
import { getIntakeReadiness } from "../src/lib/voice-receptionist-wizard/intake/readiness";

function baseCtx(): VoiceV2CallContext {
  return {
    sessionKey: "cc:test",
    workspaceId: "ws",
    agentId: "a",
    businessTimezone: "America/New_York",
    intakeSchema: {
      fields: [
        {
          key: "name",
          enabled: true,
          requirementLevel: "required_before_booking",
          label: "Name",
          questionText: "Name?",
          valueType: "text",
        },
      ],
    },
    intakeState: {
      name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    dialog: defaultVoiceV2DialogState(),
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
  };
}

function runTurn(ctx: VoiceV2CallContext, utterance: string) {
  const prior = ctx.dialog?.activeGoal ?? "UNKNOWN";
  const interp = interpretCallerUtterance(utterance, { activeGoal: prior });
  return applyCallerIntentToCallContext(ctx, interp).ctx;
}

let ctx = baseCtx();
ctx = runTurn(ctx, "I need an appointment next Friday morning.");
ctx = runTurn(ctx, "8 AM would be good.");

const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
const stage = deriveVoiceV2NextStage({
  workflow: ctx.bookingWorkflow!,
  readiness,
  hasActiveOfferSet: false,
  bookingStrategy: "MICROSOFT_365",
});

if (ctx.dialog?.activeGoal !== "BOOK_APPOINTMENT") {
  console.error("FAIL active goal", ctx.dialog?.activeGoal);
  process.exit(1);
}
if (stage === "CALLBACK_REQUESTED") {
  console.error("FAIL stage CALLBACK_REQUESTED");
  process.exit(1);
}
if (!ctx.dialog?.schedulingHints?.requestedDay) {
  console.error("FAIL missing scheduling hints");
  process.exit(1);
}

console.log("PASS gpt-live caller intent turns", { stage, goal: ctx.dialog?.activeGoal });
