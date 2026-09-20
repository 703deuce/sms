/**
 * Static checks for Voice V3 post-call pipeline modules (no DB required).
 */
import assert from "node:assert/strict";
import {
  isVoiceV3LiveKitCall,
  isVoiceV3PostCallEligible,
} from "../src/lib/voice-v3/post-call/is-voice-v3-livekit-call";

function run() {
  assert.equal(
    isVoiceV3LiveKitCall({
      metadata: { source: "livekit_voice_runtime", livekitRoomName: "r1" },
      telnyxConversationId: null,
    }),
    true,
  );
  assert.equal(
    isVoiceV3PostCallEligible({
      metadata: { voiceV3WizardBound: true },
      telnyxConversationId: null,
      agentId: "a1",
    }),
    true,
  );
  assert.equal(
    isVoiceV3PostCallEligible({
      metadata: { voiceTransport: "voice_v3_basic" },
      telnyxConversationId: null,
      agentId: "a1",
    }),
    true,
  );
  console.log("test-voice-v3-post-call-pipeline: PASS");
}

run();
