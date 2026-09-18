import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { attemptSemanticExtractionRetry } from "../src/lib/voice-v3/intake/semantic-extraction-retry";
import { clearCallerTurnManager } from "../src/lib/voice-v3/conversation/caller-turn-manager";

const SESSION = "sem_retry_empty";
const NOW = new Date("2026-09-18T16:00:00.000Z");

async function main() {
  clearVoiceV3CallRuntimeStore();
  clearCallerTurnManager(SESSION);
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:retry_empty",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
    now: NOW,
  });

  const result = await attemptSemanticExtractionRetry({
    liveSessionId: SESSION,
    nested: { type: "response.output_item.done", response: { id: "resp_empty_test" } },
    priorArgumentsJson: "{}",
    runtime,
    send: () => {},
  });

  assert.equal(result.applied, false);
  assert.equal(result.attemptId, null);
  console.log("test-voice-v3-semantic-retry-empty-utterance: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
