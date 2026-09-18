import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { markDurableBookingCanceled } from "./durable-booking-store";
import { buildLiveCancellationConfirmedAppend } from "./live-management-context";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import type { CancelBookingRequest } from "./cancel-booking-types";
import { runAuthoritativeOperation } from "../operations/run-authoritative-operation";
import { mapProviderFailureToRecoveryCode } from "../operations/provider-failure-map";

export type CancelBookingExecutor = (input: {
  request: CancelBookingRequest;
  config: VoiceV3AgentConfig;
}) => Promise<{ ok: true; durationMs: number } | { ok: false; message: string; outcomeUncertain?: boolean }>;

const inFlight = new Set<string>();
const confirmedAttempts = new Set<string>();

export async function dispatchCancellationIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: VoiceV3LiveRuntimeHooks & {
    cancelBooking?: CancelBookingExecutor;
  } = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);

  const existing = ctx.appointmentManagement.verifiedExisting;
  if (!existing) return;

  if (
    rules.cancellationPhase === "CANCELLATION_CONFIRMATION_REQUIRED" &&
    ctx.appointmentManagement.cancellation.awaitingConfirmation
  ) {
    console.log("CANCELLATION_CONFIRMATION_REQUIRED", {
      call_id: ctx.callId,
      provider_event_id: existing.providerEventId,
    });
    return;
  }

  if (rules.requiredAction !== "CANCEL_APPOINTMENT") return;

  const attemptId =
    ctx.appointmentManagement.cancellation.cancellationAttemptId ?? `cxl_${createId()}`;
  if (confirmedAttempts.has(attemptId)) return;
  if (inFlight.has(ctx.liveSessionId)) return;

  inFlight.add(ctx.liveSessionId);
  console.log("CANCELLATION_REQUESTED", { call_id: ctx.callId, attempt_id: attemptId });

  try {
    const request: CancelBookingRequest = {
      callId: ctx.callId,
      cancellationAttemptId: attemptId,
      providerCalendarId: existing.providerCalendarId,
      providerEventId: existing.providerEventId,
    };

    const result = await runAuthoritativeOperation({
      runtime,
      operationId: attemptId,
      type: "CANCEL_APPOINTMENT",
      prepareStart: (c) => ({
        ...c,
        appointmentManagement: {
          ...c.appointmentManagement,
          cancellation: {
            ...c.appointmentManagement.cancellation,
            phase: "CANCELLATION_COMMITTING",
            cancellationAttemptId: attemptId,
            awaitingConfirmation: false,
          },
        },
        runtime: { version: c.runtime.version + 1 },
      }),
      isStillAuthoritative: (c) =>
        c.appointmentManagement.verifiedExisting?.providerEventId === existing.providerEventId &&
        c.dialog.activeGoal === "CANCEL_APPOINTMENT",
      execute: async () => {
        console.log("CANCELLATION_COMMIT_SENT", {
          call_id: ctx.callId,
          cancellation_attempt_id: attemptId,
          provider_event_id: existing.providerEventId,
        });
        if (!hooks.cancelBooking) {
          return { ok: true, value: { durationMs: 0 } };
        }
        const r = await hooks.cancelBooking({ request, config: runtime.config });
        if (r.ok) return { ok: true, value: { durationMs: r.durationMs } };
        return {
          ok: false,
          failureCode: mapProviderFailureToRecoveryCode(r.message),
          outcomeUncertain: r.outcomeUncertain,
        };
      },
      applySuccess: (c) => {
        confirmedAttempts.add(attemptId);
        markDurableBookingCanceled(existing.internalBookingId);
        console.log("CANCELLATION_CONFIRMED", {
          call_id: ctx.callId,
          cancellation_attempt_id: attemptId,
          provider_event_id: existing.providerEventId,
        });
        pushLiveThinkingEvent(
          hooks,
          buildLiveCancellationConfirmedAppend({
            localStart: existing.localStart,
            timezone: existing.timezone,
          }),
          "cancellation_confirmed",
        );
        return {
          ...c,
          appointmentManagement: {
            ...c.appointmentManagement,
            verifiedExisting: null,
            cancellation: {
              phase: "CANCELLATION_CONFIRMED",
              cancellationAttemptId: attemptId,
              awaitingConfirmation: false,
            },
          },
        };
      },
      applyFailure: (c, terminal, failureCode) => ({
        ...c,
        appointmentManagement: {
          ...c.appointmentManagement,
          cancellation: {
            phase:
              terminal === "OUTCOME_UNKNOWN"
                ? "CANCELLATION_OUTCOME_UNKNOWN"
                : "CANCELLATION_FAILED",
            cancellationAttemptId: attemptId,
            awaitingConfirmation: false,
          },
        },
      }),
    });

    if (!result.ok && result.outcomeUncertain) {
      console.log("CANCELLATION_OUTCOME_UNKNOWN", { call_id: ctx.callId, attempt_id: attemptId });
    }
  } finally {
    inFlight.delete(ctx.liveSessionId);
  }
}
