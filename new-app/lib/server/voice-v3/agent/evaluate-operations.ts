import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import type { BackendActionKind } from "./conversation-action";
import { deriveAsyncOperations, summarizeActiveOperations } from "./async-operations";
import type { VoiceV3Operation } from "../operations/types";

export interface OperationsEvaluation {
  all: VoiceV3Operation[];
  active: ReturnType<typeof summarizeActiveOperations>;
  safeNextActions: BackendActionKind[];
}

export function evaluateOperations(
  ctx: VoiceV3CallContext,
  rules: VoiceV3RuleEvaluation,
): OperationsEvaluation {
  const all = deriveAsyncOperations(ctx);
  const active = summarizeActiveOperations(ctx);

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
