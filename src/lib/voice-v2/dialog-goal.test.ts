import { describe, expect, it } from "vitest";

import {
  applyDialogAndWorkflowPrecedence,
  filterAllowedActionsForDialog,
  defaultVoiceV2DialogState,
} from "./dialog-goal";
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
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
    dialog: defaultVoiceV2DialogState(),
  };
}

describe("dialog goal precedence", () => {
  it("ignores prefer_callback when active booking intent and scheduling preference exist", () => {
    const ctx = minimalCtx();
    let workflow = {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-25",
      callbackRequested: false,
    };
    const { workflow: next, dialog } = applyDialogAndWorkflowPrecedence({
      ctx,
      raw: { workflow_signal: "prefer_callback" },
      savedKeys: [],
      workflow,
    });
    expect(next.callbackRequested).toBe(false);
    expect(dialog.activeGoal).toBe("BOOK_APPOINTMENT");
  });

  it("allows explicit callback to override booking", () => {
    const ctx = minimalCtx();
    const workflow = {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-25",
    };
    const { workflow: next, dialog } = applyDialogAndWorkflowPrecedence({
      ctx,
      raw: { explicit_callback_requested: true, intent_evidence: "just call me back" },
      savedKeys: [],
      workflow,
    });
    expect(next.callbackRequested).toBe(true);
    expect(next.explicitCallbackRequested).toBe(true);
    expect(dialog.activeGoal).toBe("CALLBACK_REQUEST");
  });

  it("filters callback_path during active booking without explicit callback", () => {
    const ctx = minimalCtx();
    ctx.dialog = { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false };
    ctx.bookingWorkflow = {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
    };
    const filtered = filterAllowedActionsForDialog(ctx, [
      "voice_v2_save_intake_fields",
      "callback_path",
      "voice_v2_find_availability",
    ]);
    expect(filtered).not.toContain("callback_path");
    expect(filtered).toContain("voice_v2_find_availability");
  });
});
