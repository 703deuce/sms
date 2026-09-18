import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { findExistingAppointment } from "./find-existing-appointment";
import type { ExistingAppointment } from "./appointment-management-types";
import { resolveAppointmentCandidate } from "./resolve-appointment-candidate";
import { dispatchRescheduleIfRequired } from "./reschedule-dispatch";
import { dispatchCancellationIfRequired } from "./cancel-dispatch";
import { buildLiveManagementCandidatesAppend } from "./live-management-context";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";

export function applyVerifiedExisting(
  ctx: VoiceV3CallContext,
  appointment: ExistingAppointment,
): VoiceV3CallContext {
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    appointmentManagement: {
      ...ctx.appointmentManagement,
      verifiedExisting: appointment,
      candidateSet: null,
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export async function dispatchAppointmentManagementIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: VoiceV3LiveRuntimeHooks & {
    fetchRevalidateBusy?: import("./book-dispatch").RevalidateBusyFetcher;
    updateBooking?: import("./reschedule-dispatch").UpdateBookingExecutor;
    cancelBooking?: import("./cancel-dispatch").CancelBookingExecutor;
  } = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const goal = ctx.dialog.activeGoal;

  if (goal !== "RESCHEDULE_APPOINTMENT" && goal !== "CANCEL_APPOINTMENT") {
    return;
  }

  console.log("APPOINTMENT_MANAGEMENT_INTENT", {
    call_id: ctx.callId,
    intent: goal,
  });

  if (!ctx.appointmentManagement.verifiedExisting) {
    if (ctx.appointmentManagement.candidateSet && ctx.appointmentManagement.pendingSelection) {
      const resolved = resolveAppointmentCandidate(
        ctx.appointmentManagement.pendingSelection,
        ctx.appointmentManagement.candidateSet,
      );
      if (resolved.status === "RESOLVED") {
        console.log("EXISTING_APPOINTMENT_VERIFIED", {
          call_id: ctx.callId,
          provider_event_id: resolved.appointment.providerEventId,
        });
        runtime.replaceContext(applyVerifiedExisting(ctx, resolved.appointment));
      }
    } else if (!ctx.appointmentManagement.lookupCompleted) {
      console.log("EXISTING_APPOINTMENT_LOOKUP_STARTED", { call_id: ctx.callId });
      const phone = ctx.intake.values.phone?.value;
      const email = ctx.intake.values.email?.value;
      const result = findExistingAppointment({
        callId: ctx.callId,
        phone,
        email,
        customerName: ctx.intake.values.name?.value,
        dateHint: ctx.scheduling.normalized,
      });

      if (result.status === "FOUND") {
        console.log("EXISTING_APPOINTMENT_FOUND", {
          call_id: ctx.callId,
          provider_event_id: result.appointment.providerEventId,
        });
        const verified = applyVerifiedExisting(ctx, result.appointment);
        runtime.replaceContext({
          ...verified,
          appointmentManagement: {
            ...verified.appointmentManagement,
            lookupCompleted: true,
            cancellation:
              goal === "CANCEL_APPOINTMENT"
                ? {
                    phase: "CANCELLATION_CONFIRMATION_REQUIRED",
                    cancellationAttemptId: null,
                    awaitingConfirmation: true,
                    boundProviderEventId: result.appointment.providerEventId,
                  }
                : verified.appointmentManagement.cancellation,
          },
        });
      } else if (result.status === "MULTIPLE") {
        console.log("EXISTING_APPOINTMENT_MULTIPLE", {
          call_id: ctx.callId,
          count: result.candidateSet.candidates.length,
        });
        runtime.replaceContext({
          ...ctx,
          appointmentManagement: {
            ...ctx.appointmentManagement,
            candidateSet: result.candidateSet,
            lookupCompleted: true,
          },
        });
        pushLiveThinkingEvent(
          hooks,
          buildLiveManagementCandidatesAppend(result.candidateSet),
          "appointment_candidates",
        );
      } else {
        runtime.replaceContext({
          ...ctx,
          appointmentManagement: { ...ctx.appointmentManagement, lookupCompleted: true },
        });
      }
    }
  }

  const rules = evaluateVoiceV3Rules(runtime.getSnapshot(), runtime.config);

  if (goal === "RESCHEDULE_APPOINTMENT") {
    if (rules.requiredAction === "FIND_AVAILABILITY") {
      const { dispatchFindAvailabilityIfRequired } = await import("./find-dispatch");
      await dispatchFindAvailabilityIfRequired(runtime, hooks);
    }
    await dispatchRescheduleIfRequired(runtime, hooks);
  }

  if (goal === "CANCEL_APPOINTMENT") {
    await dispatchCancellationIfRequired(runtime, hooks);
  }
}
