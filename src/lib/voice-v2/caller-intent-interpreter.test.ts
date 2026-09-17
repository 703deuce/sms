import { describe, expect, it } from "vitest";
import {
  applyCallerIntentToCallContext,
  interpretCallerUtterance,
} from "./caller-intent-interpreter";
import { defaultVoiceV2DialogState } from "./dialog-goal";
import { defaultVoiceV2BookingWorkflow } from "./booking-workflow";
import type { VoiceV2CallContext } from "./intake/types";

function minimalCtx(): VoiceV2CallContext {
  return {
    sessionKey: "cc:test",
    workspaceId: "ws",
    agentId: "agent",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    dialog: defaultVoiceV2DialogState(),
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
  };
}

describe("caller-intent-interpreter", () => {
  it("persists BOOK_APPOINTMENT across name answer", () => {
    let ctx = minimalCtx();
    const book = interpretCallerUtterance("I need to make an appointment.", {
      activeGoal: "UNKNOWN",
    });
    ctx = applyCallerIntentToCallContext(ctx, book).ctx;
    expect(ctx.dialog?.activeGoal).toBe("BOOK_APPOINTMENT");

    const name = interpretCallerUtterance("Anthony.", { activeGoal: "BOOK_APPOINTMENT" });
    ctx = applyCallerIntentToCallContext(ctx, name).ctx;
    expect(ctx.dialog?.activeGoal).toBe("BOOK_APPOINTMENT");
  });

  it("does not treat Amy callback mention as caller callback", () => {
    const interp = interpretCallerUtterance("If needed we can call you back.", {
      activeGoal: "BOOK_APPOINTMENT",
    });
    expect(interp.intent).toBe("BOOK_APPOINTMENT");
    expect(interp.explicit).toBe(false);
  });

  it("explicit callback overrides active booking", () => {
    let ctx = minimalCtx();
    ctx.dialog = { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false };
    ctx.bookingWorkflow = { ...defaultVoiceV2BookingWorkflow(), bookingIntentActive: true };
    const cb = interpretCallerUtterance("Just have somebody call me back instead.", {
      activeGoal: "BOOK_APPOINTMENT",
    });
    ctx = applyCallerIntentToCallContext(ctx, cb).ctx;
    expect(ctx.dialog?.activeGoal).toBe("CALLBACK_REQUEST");
    expect(ctx.dialog?.explicitCallbackRequested).toBe(true);
  });
});
