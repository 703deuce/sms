import assert from "node:assert/strict";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { buildReceptionistBusinessContext } from "../src/lib/voice/receptionist/build-business-context";
import { DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID } from "../src/lib/voice/elevenlabs/receptionist-voice-catalog";

const snapshot = compileReceptionistConfig({
  agentName: "Sarah",
  businessName: "Summit Electric",
  businessDescription:
    "Regular hours are Monday through Friday 8am to 5pm. Our diagnostic fee is $89.",
  greeting: "Hi, thanks for calling Summit Electric.",
  language: "en-US",
  timezone: "America/New_York",
  answerTiming: "every_call",
  capabilities: ["answer_questions", "take_messages"],
  collectFields: ["name", "phone"],
  voiceId: "marin",
});

assert.equal(snapshot.realtimeModel, "gpt-realtime-2.1");
assert.equal(snapshot.realtimeOutputMode, "elevenlabs");
assert.equal(snapshot.ttsModel, "eleven_flash_v2_5");
assert.equal(snapshot.voiceId, DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID);
assert.ok(snapshot.businessContext.includes("BUSINESS CONTEXT"));
assert.ok(snapshot.businessContext.includes("Summit Electric"));
assert.ok(snapshot.businessContext.includes("Monday"));
assert.ok(snapshot.businessContext.includes("get_business_answer only for long-tail"));

const block = buildReceptionistBusinessContext(snapshot);
assert.ok(block.includes("Summit Electric"));

console.log("test-receptionist-business-context: ok");
