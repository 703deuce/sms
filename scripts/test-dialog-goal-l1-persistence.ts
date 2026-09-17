/**
 * Regression: dialog.activeGoal must survive L1 hydrate across call: and cc: aliases.
 */
import assert from "node:assert/strict";

import { applyCallerIntentToCallContext, interpretCallerUtterance } from "@/lib/voice-v2/caller-intent-interpreter";
import { dialogFromContext, defaultVoiceV2DialogState } from "@/lib/voice-v2/dialog-goal";
import { defaultVoiceV2BookingWorkflow, transitionAfterIntakeSave } from "@/lib/voice-v2/booking-workflow";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import {
  clearVoiceV2CallContextL1ForTests,
  createVoiceV2CallContext,
  getVoiceV2CallContextL1,
  resetVoiceV2CallContextStoreForTests,
} from "@/lib/voice-v2/session/call-context-store";
import { setVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import { getIntakeReadiness } from "@/lib/voice-v2/intake/readiness";

function basePayload(sessionKey: string): VoiceV2CallContext {
  return {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
    dialog: defaultVoiceV2DialogState(),
    capabilities: { voiceV2PstnLiveBooking: true, bookingStrategy: "MICROSOFT_365" },
  };
}

async function main() {
  clearVoiceV2CallContextL1ForTests();
  resetVoiceV2CallContextStoreForTests();

  const canonical = "call:cm_test_dialog";
  const cc = "v3:test-cc-dialog";
  await createVoiceV2CallContext(
    {
      payload: basePayload(canonical),
      identity: {
        sessionKey: canonical,
        callId: "cm_test_dialog",
        workspaceId: "ws_test",
        agentId: "agent_test",
        telnyxCallControlId: cc,
      },
      enrollment: { enrolledAt: new Date().toISOString() },
    },
    { l2Persist: "await" },
  );

  let ctx = getVoiceV2CallContextL1(`cc:${cc}`);
  assert.ok(ctx);
  const interpretation = interpretCallerUtterance("I need to book an appointment", {
    activeGoal: "UNKNOWN",
  });
  const applied = applyCallerIntentToCallContext(ctx, interpretation);
  setVoiceV2CallContext(applied.ctx);

  const viaCc = getVoiceV2CallContextL1(`cc:${cc}`);
  const viaCall = getVoiceV2CallContextL1(canonical);
  assert.equal(dialogFromContext(viaCc!).activeGoal, "BOOK_APPOINTMENT");
  assert.equal(dialogFromContext(viaCall!).activeGoal, "BOOK_APPOINTMENT");
  console.log("PASS dialog goal L1 alias persistence");

  const bookingCtx: VoiceV2CallContext = {
    ...basePayload("cc:test"),
    dialog: { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false },
    bookingWorkflow: { ...defaultVoiceV2BookingWorkflow(), bookingIntentActive: true },
    intakeState: {
      name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: "" },
    },
  };
  const next = transitionAfterIntakeSave({
    ctx: bookingCtx,
    raw: { workflow_signal: "cancel_booking", name: "Anthony" },
    savedKeys: ["name"],
    readiness: getIntakeReadiness(bookingCtx.intakeSchema, bookingCtx.intakeState),
    voiceV2PstnLiveBooking: true,
    bookingStrategy: "MICROSOFT_365",
  });
  assert.equal(next.bookingWorkflow?.bookingCancelled, false);
  assert.notEqual(next.bookingWorkflow?.nextStage, "COMPLETE");
  console.log("PASS legacy cancel_booking blocked during booking", next.bookingWorkflow?.nextStage);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
