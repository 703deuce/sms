import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import type { BackendActionKind } from "./conversation-action";
import {
  deriveAsyncOperations,
  type AgentOperationSummary,
  type AsyncOperationState,
} from "./async-operations";

export interface OperationsEvaluation {
  all: AsyncOperationState[];
  active: AgentOperationSummary[];
  safeNextActions: BackendActionKind[];
}

export function evaluateOperations(
  ctx: VoiceV3CallContext,
  rules: VoiceV3RuleEvaluation,
): OperationsEvaluation {
  const all = deriveAsyncOperations(ctx);
  const active = all
    .filter((o) => o.status === "RUNNING" || o.status === "PENDING" || o.status === "OUTCOME_UNKNOWN")
    .map((o) => ({
      operationId: o.operationId,
      type: o.type,
      status: o.status,
    }));

  const safeNextActions: BackendActionKind[] = [];
  const findRunning = all.some((o) => o.type === "FIND_AVAILABILITY" && o.status === "RUNNING");
  const bookRunning = all.some((o) => o.type === "BOOK_APPOINTMENT" && o.status === "RUNNING");

  if (rules.mayFindAvailability && !findRunning && ctx.availability.status !== "pending") {
    safeNextActions.push("FIND_AVAILABILITY");
  }
  if (rules.bookingReady && !bookRunning) {
    safeNextActions.push("BOOK_APPOINTMENT");
  }
  if (rules.rescheduleReady) {
    safeNextActions.push("RESCHEDULE_APPOINTMENT");
  }
  if (rules.cancellationPhase === "CANCELLATION_READY") {
    safeNextActions.push("CANCEL_APPOINTMENT");
  }

  return { all, active, safeNextActions };
}
