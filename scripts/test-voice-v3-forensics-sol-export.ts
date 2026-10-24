/**
 * Voice V3 forensics export + Sol backend model guards (no network).
 */
import assert from "node:assert/strict";
import {
  VOICE_V3_ASTRA_MODEL,
  VOICE_V3_ASTRA_MODEL_DEFAULT,
  VOICE_V3_ASTRA_REASONING_EFFORT,
} from "../src/lib/voice-v3/intake/delegation-config";
import {
  appendVoiceV3ForensicEvent,
  initVoiceV3CallForensics,
  mergeCanonicalConversationTurn,
  snapshotVoiceV3CallForensics,
} from "../src/lib/voice-v3/telemetry/call-forensics";
import {
  exportAllCallerTurnTimingForSession,
  noteCallerTurnTimingCommitted,
} from "../src/lib/voice-v3/telemetry/caller-turn-timing";
import { speechTimestampToSegmentMs } from "../src/lib/voice-v3/telemetry/forensics-persist";

function main() {
  assert.equal(VOICE_V3_ASTRA_MODEL_DEFAULT, "gpt-5.6-sol");
  if (!process.env.VOICE_V3_ASTRA_MODEL?.trim()) {
    assert.equal(VOICE_V3_ASTRA_MODEL, "gpt-5.6-sol");
  }
  assert.equal(VOICE_V3_ASTRA_REASONING_EFFORT, "none");

  assert.equal(speechTimestampToSegmentMs(5.1, null), 5100);
  assert.equal(speechTimestampToSegmentMs(7.2, null), 7200);
  const anchor = 1_725_000_000;
  assert.equal(speechTimestampToSegmentMs(anchor + 12.5, anchor), 12500);
  assert.equal(speechTimestampToSegmentMs(anchor * 1000, anchor), null);

  const liveSessionId = "lk_test_forensics_1";
  initVoiceV3CallForensics({
    callId: liveSessionId,
    liveSessionId,
    workspaceId: "ws_test",
    agentId: "agent_test",
  });

  appendVoiceV3ForensicEvent(liveSessionId, "VOICE_V3_SESSION_BOOTSTRAP_START", {
    backend_model: VOICE_V3_ASTRA_MODEL,
    live_voice_id: "marin",
  });

  noteCallerTurnTimingCommitted({
    liveSessionId,
    turnId: "turn_1",
    turnSequence: 1,
  });

  mergeCanonicalConversationTurn(liveSessionId, {
    role: "assistant",
    text: "Thank you for calling.",
    committedVia: "AGENT_TURN_COMMITTED",
    conversationItemId: "item_asst_1",
    speech: { started_speaking_at: 5.1, stopped_speaking_at: 7.2 },
  });

  mergeCanonicalConversationTurn(liveSessionId, {
    role: "user",
    text: "I need to schedule an appointment.",
    committedVia: "CALLER_UTTERANCE_COMMITTED",
    turnKey: "turn_1",
  });

  const snap = snapshotVoiceV3CallForensics(liveSessionId);
  assert.ok(snap);
  assert.equal(snap!.canonicalTurns.length, 2);
  assert.equal(snap!.canonicalTurns[0]!.role, "assistant");
  assert.equal(snap!.events.length >= 1, true);
  assert.equal(exportAllCallerTurnTimingForSession(liveSessionId).length, 1);

  console.log("PASS voice-v3 forensics + sol export checks");
}

main();
