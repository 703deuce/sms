import "server-only";

/** Voice V2 ACR hydration removed — wizard PSTN uses Voice V3 only. */
export async function resolveVoiceV2SmsContinuation(_input: {
  workspaceId: string;
  conversationId: string;
  callerE164?: string;
  sendingE164?: string;
}): Promise<null> {
  return null;
}

export function mergeVoiceContinuationIntoConversationTurns<T extends { role: string; content: string }>(
  turns: T[],
  _continuation: null,
): T[] {
  return turns;
}
