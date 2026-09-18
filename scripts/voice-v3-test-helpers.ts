import {
  forceCommitCallerTurn,
  noteCallerTranscriptDelta,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";

/** Test helper: seed committed caller utterance for semantic retry tests. */
export function setCallerUtteranceForTests(liveSessionId: string, utterance: string): void {
  noteCallerTranscriptDelta(liveSessionId, utterance);
  forceCommitCallerTurn(liveSessionId);
}
