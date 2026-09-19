/**
 * Legacy CallerMeaning merge for scripts/tests only — not on the production PSTN tool path.
 * Production uses typed tools → merge-intake-state.ts and tool-specific handlers.
 */
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CapturedField, VoiceV3CallContext } from "../state/call-context";
import type { CallerMeaning } from "./caller-meaning-schema";
import { schedulingMeaningHasSignal } from "../time/scheduling-normalizer";
import type { SchedulingMeaning } from "../time/scheduling-types";
import { mergeSchedulingMeaningIntoContext } from "./merge-scheduling-meaning";
import { applySlotSelectionFromMeaning } from "../calendar/apply-slot-selection";
import { emptySlotSelectionMeaning } from "./slot-selection-schema";
import {
  appointmentSelectionHasSignal,
  emptyAppointmentSelectionMeaning,
} from "./appointment-selection-schema";
import { applyGoalLifecycleFromMeaning } from "../agent/goal-manager";
import { recordExplicitHandoff } from "../agent/escalation";
import { normalizeCallerGoals } from "./normalize-caller-goals";

export interface ApplyCallerMeaningResult {
  context: VoiceV3CallContext;
  fieldsChanged: string[];
  correctionCount: number;
  schedulingGenerationChanged: boolean;
  slotSelectionChanged: boolean;
  slotSelectionResolved: boolean;
}

function isConfiguredKey(config: VoiceV3AgentConfig, key: string): boolean {
  return config.intakeFields.some((f) => f.key === key);
}

function logUnknownIntakeKeyRejected(input: {
  callId: string;
  liveSessionId: string;
  key: string;
  stateVersion: number;
}): void {
  console.log("VOICE_V3_UNKNOWN_INTAKE_KEY_REJECTED", {
    call_id: input.callId,
    live_session_id: input.liveSessionId,
    key: input.key,
    state_version: input.stateVersion,
  });
}

function toSchedulingMeaning(sched: CallerMeaning["scheduling"]): SchedulingMeaning {
  return { ...sched };
}

/**
 * Deterministic merge — no tools, no second model pass.
 */
export function applyCallerMeaningToContext(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  meaning: CallerMeaning,
  at: Date = new Date(),
): ApplyCallerMeaningResult {
  const updatedAt = at.toISOString();
  const values = { ...ctx.intake.values };
  const fieldsChanged = new Set<string>();
  let correctionCount = 0;

  for (const row of meaning.captured_fields) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value) continue;
    if (!isConfiguredKey(config, key)) {
      logUnknownIntakeKeyRejected({
        callId: ctx.callId,
        liveSessionId: ctx.liveSessionId,
        key,
        stateVersion: ctx.runtime.version,
      });
      continue;
    }
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
  }

  for (const row of meaning.corrections) {
    const key = row.key.trim();
    const value = row.new_value.trim();
    if (!key || !value) continue;
    if (!isConfiguredKey(config, key)) {
      logUnknownIntakeKeyRejected({
        callId: ctx.callId,
        liveSessionId: ctx.liveSessionId,
        key,
        stateVersion: ctx.runtime.version,
      });
      continue;
    }
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
    correctionCount += 1;
  }

  let workingCtx = ctx;
  let schedulingGenerationChanged = false;
  const schedMeaning = toSchedulingMeaning(meaning.scheduling);

  if (schedulingMeaningHasSignal(schedMeaning)) {
    const schedMerge = mergeSchedulingMeaningIntoContext(
      { ...workingCtx, intake: { values }, updatedAt },
      schedMeaning,
      at,
    );
    workingCtx = schedMerge.context;
    schedulingGenerationChanged = schedMerge.schedulingGenerationChanged;
  } else {
    workingCtx = {
      ...workingCtx,
      updatedAt,
      intake: { values },
      runtime: { version: workingCtx.runtime.version + 1 },
    };
  }

  let preGoalCtx: VoiceV3CallContext = workingCtx;
  for (const g of normalizeCallerGoals(meaning)) {
    if (g.type === "TRANSFER" && (g.disposition === "START" || g.disposition === "CHANGE")) {
      preGoalCtx = recordExplicitHandoff(preGoalCtx);
    }
  }

  let context: VoiceV3CallContext = applyGoalLifecycleFromMeaning({
    ctx: preGoalCtx,
    meaning,
    at,
  });

  const slotApply = applySlotSelectionFromMeaning(
    context,
    meaning.slot_selection ?? emptySlotSelectionMeaning(),
    at,
  );
  context = slotApply.context;

  if (appointmentSelectionHasSignal(meaning.appointment_selection ?? emptyAppointmentSelectionMeaning())) {
    context = {
      ...context,
      appointmentManagement: {
        ...context.appointmentManagement,
        pendingSelection: meaning.appointment_selection ?? emptyAppointmentSelectionMeaning(),
      },
      runtime: { version: context.runtime.version + 1 },
    };
  }

  const cancelConfirm = meaning.cancellation_confirmation ?? "NONE";
  if (cancelConfirm !== "NONE" && context.appointmentManagement.verifiedExisting) {
    const bound = context.appointmentManagement.verifiedExisting.providerEventId;
    if (cancelConfirm === "CONFIRM") {
      console.log("CANCELLATION_CONFIRMED_BY_CALLER", { call_id: context.callId, provider_event_id: bound });
      context = {
        ...context,
        appointmentManagement: {
          ...context.appointmentManagement,
          lastCancellationConfirmation: "CONFIRM",
          cancellation: {
            ...context.appointmentManagement.cancellation,
            awaitingConfirmation: true,
            boundProviderEventId: bound,
            phase: "CANCELLATION_READY",
          },
        },
        runtime: { version: context.runtime.version + 1 },
      };
    } else if (cancelConfirm === "DECLINE") {
      console.log("CANCELLATION_DECLINED", { call_id: context.callId });
      context = {
        ...context,
        appointmentManagement: {
          ...context.appointmentManagement,
          lastCancellationConfirmation: "DECLINE",
          cancellation: {
            phase: "NONE",
            cancellationAttemptId: null,
            awaitingConfirmation: false,
            boundProviderEventId: null,
          },
          candidateSet: null,
          verifiedExisting: null,
          lookupCompleted: false,
        },
        runtime: { version: context.runtime.version + 1 },
      };
    }
  }

  if (
    meaning.post_book_intent === "CHANGE_CONFIRMED_APPOINTMENT" &&
    context.booking.confirmed
  ) {
    console.log("POST_BOOK_CHANGE_REQUESTED", {
      call_id: context.callId,
      live_session_id: context.liveSessionId,
      booking_attempt_id: context.booking.confirmed?.bookingAttemptId ?? null,
    });
    context = {
      ...context,
      booking: {
        ...context.booking,
        postBookChangeRequested: true,
      },
      runtime: { version: context.runtime.version + 1 },
    };
  }

  return {
    context,
    fieldsChanged: [...fieldsChanged],
    correctionCount,
    schedulingGenerationChanged,
    slotSelectionChanged: slotApply.selectionChanged,
    slotSelectionResolved: slotApply.resolution?.status === "RESOLVED",
  };
}
