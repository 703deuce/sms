import type { ConversationAction } from "./conversation-action";

export function formatConversationActionForSnapshot(action: ConversationAction): string {
  switch (action.type) {
    case "ASK_REQUIRED_FIELD":
      return `ASK_REQUIRED_FIELD(${action.fieldKey})`;
    case "PRESENT_AVAILABILITY":
      return `PRESENT_AVAILABILITY(${action.offerSetId})`;
    case "ACKNOWLEDGE_PENDING_ACTION":
      return `ACKNOWLEDGE_PENDING_ACTION(${action.operationId})`;
    case "INFORM_TEMPORARY_FAILURE":
      return `INFORM_TEMPORARY_FAILURE(${action.failureCode})`;
    case "CLARIFY_SCHEDULING":
      return `CLARIFY_SCHEDULING(${action.reason})`;
    default:
      return action.type;
  }
}
