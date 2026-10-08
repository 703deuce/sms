import type { ArLunaConversationMessage } from "./v3-workflow/luna-conversation-context";

export type ArSmsSharedTurnSnapshotFields = {
  latestCustomerMessage: string;
  conversationHistory: ArLunaConversationMessage[];
  verifiedContextBlock: string;
  relatedAppointmentsSummary: string;
};

export function formatSnapshotForContextAgentUserMessage(
  snapshot: ArSmsSharedTurnSnapshotFields,
): string {
  const historyLines = snapshot.conversationHistory.map(
    (m, i) => `${i + 1}. ${m.role}: ${m.content}`,
  );
  return [
    "--- Verified appointment & workflow ---",
    snapshot.verifiedContextBlock,
    snapshot.relatedAppointmentsSummary
      ? `--- Related appointments ---\n${snapshot.relatedAppointmentsSummary}`
      : "",
    "--- Conversation history (chronological) ---",
    historyLines.join("\n"),
    "--- Latest customer message ---",
    snapshot.latestCustomerMessage,
  ]
    .filter(Boolean)
    .join("\n\n");
}
