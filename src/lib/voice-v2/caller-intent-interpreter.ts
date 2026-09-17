import "server-only";

import type { VoiceDialogGoal, VoiceV2DialogState } from "./dialog-goal";
import {
  applyDialogAndWorkflowPrecedence,
  dialogFromContext,
  isActiveBookingGoal,
} from "./dialog-goal";
import type { VoiceV2CallContext } from "./intake/types";
import {
  deriveVoiceV2NextStage,
  mergeWorkflowIntoContext,
  workflowFromContext,
  type VoiceV2BookingWorkflow,
} from "./booking-workflow";
import { getIntakeReadiness } from "./intake/readiness";
import { mergeCallerFactsIntoCallContext } from "./merge-caller-facts";

export type VoiceCallerIntentEntities = {
  requested_day?: string | null;
  requested_daypart?: string | null;
  requested_time?: string | null;
};

export type VoiceCallerIntentInterpretation = {
  intent: VoiceDialogGoal;
  confidence: number;
  explicit: boolean;
  evidence: string;
  entities: VoiceCallerIntentEntities;
  /** Temporary side question — do not abandon active booking goal. */
  digression: boolean;
};

const EXPLICIT_CALLBACK_RE =
  /\b(just\s+)?(have\s+)?(someone|somebody)\s+call\s+me\s+back\b|\bcall\s+me\s+back\s+instead\b|\bdon'?t\s+want\s+to\s+book\b|\bnot\s+trying\s+to\s+book\b|\bonly\s+(want|need)\s+(a\s+)?callback\b/i;

const EXPLICIT_BOOK_RE =
  /\b(book|schedule|make)\s+(an?\s+)?(appointment|appt)\b|\bneed\s+(an?\s+)?appointment\b|\bwant\s+to\s+(book|schedule)\b|\bset\s+up\s+(an?\s+)?appointment\b/i;

const SCHEDULING_HINT_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+\w+)\b/i;

const DAYPART_RE = /\b(morning|afternoon|evening|noon)\b/i;

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

const CANCEL_BOOK_RE =
  /\b(cancel\s+(the\s+)?(appointment|booking)|never\s+mind.*book|forget\s+(about\s+)?book)/i;

const TRANSFER_RE =
  /\b(speak\s+to|talk\s+to)\s+(a\s+)?(human|person|representative|agent)\b|\btransfer\s+me\b/i;

const DIGRESSION_RE =
  /\b(where\s+are\s+you\s+located|what\s+are\s+your\s+hours|how\s+do\s+i\s+get\s+there|parking)\b/i;

function extractEntities(utterance: string): VoiceCallerIntentEntities {
  const entities: VoiceCallerIntentEntities = {};
  const day = utterance.match(SCHEDULING_HINT_RE);
  if (day) entities.requested_day = day[1];
  const daypart = utterance.match(DAYPART_RE);
  if (daypart) entities.requested_daypart = daypart[1].toLowerCase();
  const time = utterance.match(TIME_RE);
  if (time) {
    const h = time[1];
    const m = time[2] ?? "00";
    const ap = time[3].toLowerCase();
    entities.requested_time = `${h}:${m} ${ap}`;
  }
  return entities;
}

/** Structured interpretation from caller speech only (deterministic; no workflow routing). */
export function interpretCallerUtterance(
  utterance: string,
  prior: { activeGoal: VoiceDialogGoal },
): VoiceCallerIntentInterpretation {
  const text = utterance.trim();
  const evidence = text.slice(0, 240);
  const entities = extractEntities(text);

  if (!text) {
    return {
      intent: prior.activeGoal,
      confidence: 0,
      explicit: false,
      evidence: "",
      entities,
      digression: false,
    };
  }

  if (EXPLICIT_CALLBACK_RE.test(text)) {
    return {
      intent: "CALLBACK_REQUEST",
      confidence: 0.97,
      explicit: true,
      evidence,
      entities,
      digression: false,
    };
  }

  if (CANCEL_BOOK_RE.test(text)) {
    return {
      intent: "CANCEL_APPOINTMENT",
      confidence: 0.9,
      explicit: true,
      evidence,
      entities,
      digression: false,
    };
  }

  if (TRANSFER_RE.test(text)) {
    return {
      intent: "TRANSFER_TO_HUMAN",
      confidence: 0.92,
      explicit: true,
      evidence,
      entities,
      digression: false,
    };
  }

  if (DIGRESSION_RE.test(text) && isActiveBookingGoal(prior.activeGoal)) {
    return {
      intent: "GENERAL_QUESTION",
      confidence: 0.85,
      explicit: false,
      evidence,
      entities,
      digression: true,
    };
  }

  if (EXPLICIT_BOOK_RE.test(text)) {
    return {
      intent: "BOOK_APPOINTMENT",
      confidence: 0.95,
      explicit: true,
      evidence,
      entities,
      digression: false,
    };
  }

  const hasSchedulingEntity =
    Boolean(entities.requested_day) ||
    Boolean(entities.requested_daypart) ||
    Boolean(entities.requested_time);

  if (hasSchedulingEntity && isActiveBookingGoal(prior.activeGoal)) {
    return {
      intent: prior.activeGoal,
      confidence: 0.88,
      explicit: false,
      evidence,
      entities,
      digression: false,
    };
  }

  if (hasSchedulingEntity) {
    return {
      intent: "BOOK_APPOINTMENT",
      confidence: 0.8,
      explicit: false,
      evidence,
      entities,
      digression: false,
    };
  }

  if (isActiveBookingGoal(prior.activeGoal)) {
    return {
      intent: prior.activeGoal,
      confidence: 0.7,
      explicit: false,
      evidence,
      entities,
      digression: false,
    };
  }

  return {
    intent: prior.activeGoal === "UNKNOWN" ? "UNKNOWN" : prior.activeGoal,
    confidence: 0.4,
    explicit: false,
    evidence,
    entities,
    digression: false,
  };
}

export type ApplyCallerIntentResult = {
  ctx: VoiceV2CallContext;
  interpretation: VoiceCallerIntentInterpretation;
  previousActiveGoal: VoiceDialogGoal;
  resultingActiveGoal: VoiceDialogGoal;
};

/** Merge per-turn caller interpretation into authoritative call context (no model workflow_signal). */
export async function applyCallerIntentToCallContext(
  ctx: VoiceV2CallContext,
  interpretation: VoiceCallerIntentInterpretation,
  callerUtterance?: string,
  opts?: { turnId?: string },
): Promise<ApplyCallerIntentResult> {
  const previousActiveGoal = dialogFromContext(ctx).activeGoal;
  let dialog: VoiceV2DialogState = { ...dialogFromContext(ctx) };
  let workflow: VoiceV2BookingWorkflow = { ...workflowFromContext(ctx) };

  if (interpretation.digression) {
    const factMerge = await mergeCallerFactsIntoCallContext(ctx, {
      utterance: (callerUtterance || interpretation.evidence).trim(),
      interpretation,
      turnId: opts?.turnId,
    });
    return {
      ctx: factMerge.ctx,
      interpretation,
      previousActiveGoal,
      resultingActiveGoal: dialogFromContext(factMerge.ctx).activeGoal,
    };
  }

  dialog.confidence = interpretation.confidence;
  dialog.explicit = interpretation.explicit;
  dialog.evidenceSpeaker = "caller";
  dialog.updatedAt = new Date().toISOString();

  if (interpretation.intent === "CALLBACK_REQUEST" && interpretation.explicit) {
    dialog.explicitCallbackRequested = true;
    dialog.activeGoal = "CALLBACK_REQUEST";
    dialog.lastIntentEvidence = interpretation.evidence;
    workflow.explicitCallbackRequested = true;
    workflow.callbackRequested = true;
  } else if (interpretation.intent === "BOOK_APPOINTMENT" || interpretation.intent === "CHANGE_APPOINTMENT") {
    if (interpretation.explicit || dialog.activeGoal === "UNKNOWN" || dialog.activeGoal === "GENERAL_QUESTION") {
      dialog.activeGoal = interpretation.intent;
      dialog.lastIntentEvidence = interpretation.evidence;
    }
    workflow.bookingIntentActive = true;
    workflow.callbackRequested = false;
    if (!interpretation.explicit && isActiveBookingGoal(previousActiveGoal)) {
      dialog.activeGoal = previousActiveGoal;
    }
  } else if (interpretation.intent === "CANCEL_APPOINTMENT" && interpretation.explicit) {
    workflow.bookingCancelled = true;
    dialog.activeGoal = "CANCEL_APPOINTMENT";
  } else if (interpretation.intent === "TRANSFER_TO_HUMAN" && interpretation.explicit) {
    dialog.activeGoal = "TRANSFER_TO_HUMAN";
  }

  if (interpretation.entities.requested_day || interpretation.entities.requested_daypart) {
    dialog.schedulingHints = {
      ...(dialog.schedulingHints ?? {}),
      requestedDay: interpretation.entities.requested_day ?? dialog.schedulingHints?.requestedDay,
      requestedDaypart:
        interpretation.entities.requested_daypart ?? dialog.schedulingHints?.requestedDaypart,
      requestedTime:
        interpretation.entities.requested_time ?? dialog.schedulingHints?.requestedTime,
    };
    workflow.bookingIntentActive = true;
  }

  const rawForDialog: Record<string, unknown> = {};
  if (dialog.explicitCallbackRequested) {
    rawForDialog.explicit_callback_requested = true;
    rawForDialog.intent_evidence = dialog.lastIntentEvidence;
  }
  if (workflow.bookingIntentActive) {
    rawForDialog.booking_intent_active = true;
  }

  const dialogApplied = applyDialogAndWorkflowPrecedence({
    ctx: { ...ctx, dialog, bookingWorkflow: workflow },
    raw: rawForDialog,
    savedKeys: [],
    workflow,
  });

  let mergedCtx = mergeWorkflowIntoContext(dialogApplied.ctx, dialogApplied.workflow);
  const factMerge = await mergeCallerFactsIntoCallContext(mergedCtx, {
    utterance: (callerUtterance || interpretation.evidence).trim(),
    interpretation,
    turnId: opts?.turnId,
  });
  mergedCtx = factMerge.ctx;

  return {
    ctx: mergedCtx,
    interpretation,
    previousActiveGoal,
    resultingActiveGoal: dialogFromContext(mergedCtx).activeGoal,
  };
}

export function logCallerIntentInterpretation(fields: Record<string, unknown>) {
  console.info(`VOICE_CALLER_INTENT ${JSON.stringify(fields)}`);
}
