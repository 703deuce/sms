import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { getReceptionistCompiledFromAdvanced } from "../src/lib/voice/receptionist/runtime";
import { RECEPTIONIST_COMPILED_KEY } from "../src/lib/voice/receptionist/types";
import assert from "node:assert";

const snapshot = compileReceptionistConfig({
  agentName: "Amy",
  businessName: "John's Plumbing",
  businessDescription: "Plumbing services in London",
  greeting: "Hi, thanks for calling John's Plumbing.",
  language: "en-US",
  answerTiming: "every_call",
  capabilities: ["answer_questions", "take_messages", "collect_info"],
  collectFields: ["name", "phone", "reason"],
  voiceId: "ava-warm-us",
});

assert.equal(snapshot.livekitProfile, "frontdesk_realtime");
assert.equal(snapshot.businessName, "John's Plumbing");
assert.equal(snapshot.fieldManifest.length, 3);
assert.ok(snapshot.enabledBuiltinTools.includes("get_business_answer"));
assert.ok(snapshot.enabledBuiltinTools.includes("take_message"));
assert.equal(RECEPTIONIST_COMPILED_KEY, "receptionistCompiled");

const fromAdvanced = getReceptionistCompiledFromAdvanced({
  [RECEPTIONIST_COMPILED_KEY]: snapshot,
});
assert.equal(fromAdvanced?.businessName, "John's Plumbing");

console.log("test-receptionist-compile: ok");
