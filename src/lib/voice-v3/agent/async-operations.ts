import type { VoiceV3CallContext } from "../state/call-context";
import type { AsyncOperationStatus, BackendActionKind } from "./conversation-action";

export interface AsyncOperationState {
  operationId: string;
  type: BackendActionKind;
  status: AsyncOperationStatus;
  stateVersionAtStart: number;
  schedulingGeneration?: number;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  failureCode?: string;
}

export interface AgentOperationSummary {
  operationId: string;
  type: BackendActionKind;
  status: AsyncOperationStatus;
}

export function deriveAsyncOperations(ctx: VoiceV3CallContext): AsyncOperationState[] {
  const ops: AsyncOperationState[] = [];
  const baseId = ctx.callId;

  if (ctx.availability.status === "pending" || ctx.availability.inFlightGeneration != null) {
    ops.push({
      operationId: `${baseId}_find_${ctx.availability.inFlightGeneration ?? ctx.scheduling.generation}`,
      type: "FIND_AVAILABILITY",
      status: "RUNNING",
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.availability.inFlightGeneration ?? ctx.scheduling.generation,
      startedAt: ctx.availability.findStartedAt ?? undefined,
      attemptCount: 1,
    });
  } else if (ctx.availability.status === "ready" && ctx.availability.activeOfferSet) {
    ops.push({
      operationId: `${baseId}_find_${ctx.scheduling.generation}`,
      type: "FIND_AVAILABILITY",
      status: "SUCCEEDED",
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.scheduling.generation,
      startedAt: ctx.availability.findStartedAt ?? undefined,
      attemptCount: 1,
    });
  } else if (ctx.availability.status === "failed") {
    ops.push({
      operationId: `${baseId}_find_${ctx.scheduling.generation}`,
      type: "FIND_AVAILABILITY",
      status: "FAILED",
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.scheduling.generation,
      failureCode: ctx.availability.lastFailure?.reason ?? "unknown",
      attemptCount: 1,
    });
  }

  const bookPhase = ctx.booking.phase;
  if (
    bookPhase === "BOOKING_REVALIDATING" ||
    bookPhase === "BOOKING_CREATING" ||
    bookPhase === "BOOKING_OUTCOME_UNKNOWN"
  ) {
    const status: AsyncOperationStatus =
      bookPhase === "BOOKING_OUTCOME_UNKNOWN" ? "OUTCOME_UNKNOWN" : "RUNNING";
    ops.push({
      operationId: ctx.booking.activeAttempt?.bookingAttemptId ?? `${baseId}_book`,
      type: "BOOK_APPOINTMENT",
      status,
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.scheduling.generation,
      attemptCount: ctx.booking.activeAttempt?.attemptNumber ?? 1,
    });
  } else if (bookPhase === "BOOKING_CONFIRMED") {
    ops.push({
      operationId: ctx.booking.confirmed?.bookingAttemptId ?? `${baseId}_book_done`,
      type: "BOOK_APPOINTMENT",
      status: "SUCCEEDED",
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.scheduling.generation,
      attemptCount: 1,
    });
  }

  const cancelPhase = ctx.appointmentManagement.cancellation.phase;
  if (cancelPhase === "CANCELLATION_COMMITTING") {
    ops.push({
      operationId:
        ctx.appointmentManagement.cancellation.cancellationAttemptId ?? `${baseId}_cancel`,
      type: "CANCEL_APPOINTMENT",
      status: "RUNNING",
      stateVersionAtStart: ctx.runtime.version,
      attemptCount: 1,
    });
  }

  const reschedulePhase = ctx.appointmentManagement.reschedule.phase;
  if (reschedulePhase === "RESCHEDULE_COMMITTING") {
    ops.push({
      operationId: ctx.appointmentManagement.reschedule.attemptId ?? `${baseId}_reschedule`,
      type: "RESCHEDULE_APPOINTMENT",
      status: "RUNNING",
      stateVersionAtStart: ctx.runtime.version,
      schedulingGeneration: ctx.scheduling.generation,
      attemptCount: 1,
    });
  }

  return ops;
}

export function findRunningOperation(
  ops: AsyncOperationState[],
  type: BackendActionKind,
): AsyncOperationState | undefined {
  return ops.find((o) => o.type === type && o.status === "RUNNING");
}
