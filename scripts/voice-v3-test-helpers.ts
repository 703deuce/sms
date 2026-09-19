import {
  clearCallerTurnManager,
  forceCommitCallerTurn,
  noteCallerTranscriptDelta,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { getCurrentConversationRevision } from "../src/lib/voice-v3/conversation/conversation-revision";

/** Test helper: seed committed caller utterance for semantic retry tests. */
export function setCallerUtteranceForTests(liveSessionId: string, utterance: string): void {
  noteCallerTranscriptDelta(liveSessionId, utterance);
  forceCommitCallerTurn(liveSessionId);
}

/** Seed monotonic committed caller turns 1..targetSequence (O(n) commits). */
export function seedConversationRevisionForTests(
  liveSessionId: string,
  targetSequence: number,
): number {
  clearCallerTurnManager(liveSessionId);
  for (let i = 1; i <= targetSequence; i++) {
    noteCallerTranscriptDelta(liveSessionId, `test_turn_${i}_${liveSessionId}`);
    forceCommitCallerTurn(liveSessionId);
  }
  return getCurrentConversationRevision(liveSessionId);
}
