import { getCallerTurns } from "./caller-turn-manager";

/** Authoritative monotonic revision — committed caller turn sequence only. */
export function getCurrentConversationRevision(liveSessionId: string): number {
  const turns = getCallerTurns(liveSessionId);
  if (!turns.length) return 0;
  return turns[turns.length - 1]!.sequence;
}

export function logConversationRevisionAdvanced(input: {
  liveSessionId: string;
  previousRevision: number;
  currentRevision: number;
}): void {
  if (input.currentRevision <= input.previousRevision) return;
  console.log("CONVERSATION_REVISION_ADVANCED", {
    live_session_id: input.liveSessionId,
    previous_revision: input.previousRevision,
    current_revision: input.currentRevision,
  });
}
