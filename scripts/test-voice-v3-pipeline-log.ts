import assert from "node:assert/strict";
import {
  redactVoiceV3PipelineString,
  summarizeAstraNestedEvent,
  voiceV3PipelineLogLevel,
} from "../src/lib/voice-v3/telemetry/pipeline-log";

function main() {
  process.env.VOICE_V3_PIPELINE_LOG = "normal";
  assert.equal(voiceV3PipelineLogLevel(), "normal");

  const redacted = redactVoiceV3PipelineString("Call +15717491060 or anthony@example.com");
  assert.equal(redacted.includes("+15717491060"), false);
  assert.equal(redacted.includes("anthony@example.com"), false);

  const summary = summarizeAstraNestedEvent({
    type: "response.function_call_arguments.done",
    response_id: "resp_1",
    name: "update_intake",
    arguments: '{"active_goal":"BOOK_APPOINTMENT"}',
  });
  assert.equal(summary.nested_type, "response.function_call_arguments.done");
  assert.equal(summary.arguments_bytes, '{"active_goal":"BOOK_APPOINTMENT"}'.length);

  console.log("PASS voice-v3 pipeline log");
}

main();
