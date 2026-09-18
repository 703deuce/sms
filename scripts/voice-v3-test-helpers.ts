import {
  appendCallerTranscriptDelta,
  commitCallerTranscript,
} from "../src/lib/voice-v3/intake/caller-turn-buffer";

/** Test helper: seed committed caller utterance for semantic retry tests. */
export function setCallerUtteranceForTests(liveSessionId: string, utterance: string): void {
  appendCallerTranscriptDelta(liveSessionId, utterance);
  commitCallerTranscript(liveSessionId);
}
