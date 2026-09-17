import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import type { IntakeFieldKey } from "./intake/types";
import {
  defaultVoiceV2BookingWorkflow,
  workflowFromContext,
  type VoiceV2BookingWorkflow,
} from "./booking-workflow";

export type VoiceDialogGoal =
  | "BOOK_APPOINTMENT"
  | "CHANGE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "CALLBACK_REQUEST"
  | "GENERAL_QUESTION"
  | "TRANSFER_TO_HUMAN"
  | "LEAVE_MESSAGE"
  | "UNKNOWN";

export type VoiceV2DialogState = {
  activeGoal: VoiceDialogGoal;
  /** Caller explicitly asked for callback-only handling (not Amy paraphrase). */
  explicitCallbackRequested: boolean;
  confidence?: number;
  explicit?: boolean;
  lastIntentEvidence?: string | null;
  evidenceSpeaker?: "caller";
  updatedAt?: string;
  workflowCycleId?: number;
  /** Natural-language scheduling hints from per-turn intent (not yet normalized to YYYY-MM-DD). */
  schedulingHints?: {
    requestedDay?: string | null;
    requestedDaypart?: string | null;
    requestedTime?: string | null;
  };
};

export function defaultVoiceV2DialogState(): VoiceV2DialogState {
  return {
    activeGoal: "UNKNOWN",
    explicitCallbackRequested: false,
    lastIntentEvidence: null,
  };
}

export function dialogFromContext(ctx: VoiceV2CallContext): VoiceV2DialogState {
  return ctx.dialog ?? defaultVoiceV2DialogState();
}

export function hasActiveBookingSchedulingIntent(
  workflow: VoiceV2BookingWorkflow,
  dialog?: VoiceV2DialogState,
): boolean {
  if (!workflow.bookingIntentActive) return false;
  if (workflow.requestedDate) return true;
  if (workflow.lastFindRequestedDate) return true;
  const hints = dialog?.schedulingHints;
  if (hints?.requestedDay || hints?.requestedDaypart || hints?.requestedTime) return true;
  return false;
}

export function isActiveBookingGoal(goal: VoiceDialogGoal): boolean {
  return goal === "BOOK_APPOINTMENT" || goal === "CHANGE_APPOINTMENT";
}

function parseExplicitCallbackFromRaw(raw: Record<string, unknown>): {
  explicit: boolean;
  evidence: string | null;
} {
  if (raw.explicit_callback_requested === true || raw.explicitCallbackRequested === true) {
    return {
      explicit: true,
      evidence: String(raw.callback_evidence || raw.intent_evidence || "").trim() || null,
    };
  }
  if (raw.explicit_callback_only === true || raw.explicitCallbackOnly === true) {
    return { explicit: true, evidence: String(raw.intent_evidence || "").trim() || null };
  }
  const intent = String(raw.caller_intent || raw.intent || "").trim().toUpperCase();
  if (intent === "CALLBACK_REQUEST" && raw.explicit === true) {
    return {
      explicit: true,
      evidence: String(raw.evidence || raw.intent_evidence || "").trim() || null,
    };
  }
  return { explicit: false, evidence: null };
}

/** Deterministic dialog + workflow flags after intake save (model supplies facts, not stages). */
export function applyDialogAndWorkflowPrecedence(input: {
  ctx: VoiceV2CallContext;
  raw: Record<string, unknown>;
  savedKeys: IntakeFieldKey[];
  workflow: VoiceV2BookingWorkflow;
}): { ctx: VoiceV2CallContext; workflow: VoiceV2BookingWorkflow; dialog: VoiceV2DialogState } {
  let workflow = { ...input.workflow };
  let dialog = { ...dialogFromContext(input.ctx) };

  if (input.raw.booking_intent_active === true || input.raw.bookingIntentActive === true) {
    workflow.bookingIntentActive = true;
  }
  if (input.savedKeys.includes("service_reason")) {
    workflow.bookingIntentActive = true;
  }

  if (input.raw.cancel_booking_requested === true || input.raw.cancelBookingRequested === true) {
    const cancelEvidence = String(
      input.raw.intent_evidence || input.raw.cancel_evidence || "",
    ).trim();
    if (cancelEvidence.length > 0) {
      workflow.bookingCancelled = true;
    }
  }

  const explicitCb = parseExplicitCallbackFromRaw(input.raw);
  if (explicitCb.explicit) {
    dialog.explicitCallbackRequested = true;
    dialog.activeGoal = "CALLBACK_REQUEST";
    dialog.lastIntentEvidence = explicitCb.evidence;
    workflow.callbackRequested = true;
    workflow.explicitCallbackRequested = true;
  } else if (workflow.bookingIntentActive) {
    if (dialog.activeGoal === "UNKNOWN" || dialog.activeGoal === "GENERAL_QUESTION") {
      dialog.activeGoal = "BOOK_APPOINTMENT";
    }
    if (
      hasActiveBookingSchedulingIntent(workflow, dialog) ||
      isActiveBookingGoal(dialog.activeGoal)
    ) {
      workflow.callbackRequested = false;
    }
  }

  return {
    ctx: { ...input.ctx, dialog, bookingWorkflow: workflow },
    workflow,
    dialog,
  };
}

/** Strip callback tool while caller is actively booking unless they explicitly opted into callback-only. */
export function filterAllowedActionsForDialog(
  ctx: VoiceV2CallContext | null,
  allowedActions: string[],
): string[] {
  if (!ctx) return allowedActions;
  const dialog = dialogFromContext(ctx);
  const workflow = workflowFromContext(ctx);
  const bookingActive =
    isActiveBookingGoal(dialog.activeGoal) || workflow.bookingIntentActive;
  if (!bookingActive) return allowedActions;
  if (dialog.explicitCallbackRequested || workflow.explicitCallbackRequested) {
    return allowedActions;
  }
  return allowedActions.filter((a) => a !== "callback_path");
}

export function shouldBlockCallbackToolForContext(ctx: VoiceV2CallContext | null): boolean {
  if (!ctx) return false;
  const filtered = filterAllowedActionsForDialog(ctx, ["callback_path"]);
  return filtered.length === 0;
}
