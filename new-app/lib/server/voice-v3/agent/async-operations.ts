import type { VoiceV3CallContext } from "../state/call-context";
import type { AsyncOperationStatus, BackendActionKind } from "./conversation-action";
import { getOperations, listActiveOperations } from "../operations/registry";
import type { VoiceV3Operation } from "../operations/types";

export interface AgentOperationSummary {
  operationId: string;
  type: BackendActionKind;
  status: AsyncOperationStatus;
}

function mapType(type: VoiceV3Operation["type"]): BackendActionKind | null {
  switch (type) {
    case "FIND_AVAILABILITY":
      return "FIND_AVAILABILITY";
    case "BOOK_APPOINTMENT":
      return "BOOK_APPOINTMENT";
    case "RESCHEDULE_APPOINTMENT":
      return "RESCHEDULE_APPOINTMENT";
    case "CANCEL_APPOINTMENT":
      return "CANCEL_APPOINTMENT";
    case "LOOKUP_APPOINTMENT":
      return "FIND_EXISTING_APPOINTMENT";
    case "REVALIDATE_SLOT":
      return "REVALIDATE_SLOT";
    case "SEMANTIC_EXTRACTION":
      return "SEMANTIC_EXTRACTION";
    default:
      return null;
  }
}

export function deriveAsyncOperations(ctx: VoiceV3CallContext): VoiceV3Operation[] {
  return Object.values(getOperations(ctx));
}

export function summarizeActiveOperations(ctx: VoiceV3CallContext): AgentOperationSummary[] {
  return listActiveOperations(ctx)
    .map((o) => {
      const mapped = mapType(o.type);
      if (!mapped) return null;
      return { operationId: o.operationId, type: mapped, status: o.status as AsyncOperationStatus };
    })
    .filter(Boolean) as AgentOperationSummary[];
}

export function findRunningOperation(
  ctx: VoiceV3CallContext,
  type: BackendActionKind,
): VoiceV3Operation | undefined {
  return listActiveOperations(ctx).find((o) => mapType(o.type) === type && o.status === "RUNNING");
}
