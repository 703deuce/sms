import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { markDurableBookingCanceled } from "./durable-booking-store";
import { buildLiveCancellationConfirmedAppend } from "./live-management-context";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import type { CancelBookingRequest } from "./cancel-booking-types";

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
    console.log("CANCELLATION_COMMIT_SENT", {
      call_id: ctx.callId,
      cancellation_attempt_id: attemptId,
      provider_event_id: existing.providerEventId,
    });

    const request: CancelBookingRequest = {
      callId: ctx.callId,
      cancellationAttemptId: attemptId,
      providerCalendarId: existing.providerCalendarId,
      providerEventId: existing.providerEventId,
    };

    let ok = false;
    if (hooks.cancelBooking) {
      const r = await hooks.cancelBooking({ request, config: runtime.config });
      ok = r.ok;
      if (!r.ok && r.outcomeUncertain) {
        runtime.replaceContext({
          ...runtime.getSnapshot(),
          appointmentManagement: {
            ...runtime.getSnapshot().appointmentManagement,
            cancellation: {
              phase: "CANCELLATION_OUTCOME_UNKNOWN",
              cancellationAttemptId: attemptId,
              awaitingConfirmation: false,
            },
          },
        });
        return;
      }
    } else {
      ok = true;
    }

    if (!ok) {
      runtime.replaceContext({
        ...runtime.getSnapshot(),
        appointmentManagement: {
          ...runtime.getSnapshot().appointmentManagement,
          cancellation: {
            phase: "CANCELLATION_FAILED",
            cancellationAttemptId: attemptId,
            awaitingConfirmation: false,
          },
        },
      });
      return;
    }

    confirmedAttempts.add(attemptId);
    markDurableBookingCanceled(existing.internalBookingId);

    runtime.replaceContext({
      ...runtime.getSnapshot(),
      appointmentManagement: {
        ...runtime.getSnapshot().appointmentManagement,
        verifiedExisting: null,
        cancellation: {
          phase: "CANCELLATION_CONFIRMED",
          cancellationAttemptId: attemptId,
          awaitingConfirmation: false,
        },
      },
    });

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
  } finally {
    inFlight.delete(ctx.liveSessionId);
  }
}
