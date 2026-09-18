import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { bootstrapVoiceV3CallContextForLiveSession } from "../src/lib/voice-v3/call-context/bootstrap";
import {
  clearVoiceV3CallContextStore,
  getVoiceV3CallContext,
} from "../src/lib/voice-v3/call-context/session-store";
import { applyDelegatedIntakeExtraction } from "../src/lib/voice-v3/intake/apply-delegated-extraction";
import { extractIntakeFromAstraResponseEvent } from "../src/lib/voice-v3/intake/delegated-response";

function main() {
  const accept = buildBasicLiveSessionAcceptParams();
  const responses =
    accept.session.delegation?.type === "responses"
      ? accept.session.delegation.responses
      : null;
  assert.ok(responses);
  const text = responses.text as { format?: { type?: string; name?: string } } | undefined;
  assert.ok(text?.format, "expected structured output format on Astra delegation");
  assert.equal(text?.format?.type, "json_schema");
  assert.equal(text?.format?.name, "voice_v3_intake_extraction");

  clearVoiceV3CallContextStore();
  bootstrapVoiceV3CallContextForLiveSession({ liveSessionId: "live_test_1" });
  assert.ok(getVoiceV3CallContext("live_test_1"));

  const payload = {
    type: "response.completed",
    response: {
      output_text: JSON.stringify({
        field_updates: [{ key: "name", value: "Alex", status: "CAPTURED" }],
        caller_intent: "book",
      }),
    },
  };
  const extraction = extractIntakeFromAstraResponseEvent(payload);
  assert.ok(extraction);
  assert.equal(extraction?.field_updates[0]?.value, "Alex");

  const applied = applyDelegatedIntakeExtraction({
    liveSessionId: "live_test_1",
    extraction: extraction!,
  });
  assert.equal(applied.applied, true);
  if (applied.applied) {
    assert.equal(applied.context.intakeState.name?.value, "Alex");
    assert.equal(applied.thinkingCommand.type, "session.thinking.append");
    assert.match(applied.thinkingCommand.content, /name="Alex"/);
  }

  clearVoiceV3CallContextStore();
  console.log("PASS voice-v3 intake pipeline");
}

main();
