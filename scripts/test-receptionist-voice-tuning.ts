import assert from "node:assert/strict";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import {
  DEFAULT_RECEPTIONIST_VOICE_TUNING,
  expressivenessToStability,
  resolveElevenLabsTuningFromVoiceConfig,
  stabilityToExpressiveness,
} from "../src/lib/voice/elevenlabs/receptionist-voice-tuning";
import { TRANSOVO_RECEPTIONIST_CONSTITUTION } from "../src/lib/voice/receptionist/transovo-receptionist-constitution";

assert.equal(expressivenessToStability("expressive"), 0.35);
assert.equal(expressivenessToStability("calm"), 0.7);
assert.equal(stabilityToExpressiveness(0.45), "balanced");

const snapshot = compileReceptionistConfig({
  agentName: "Amy",
  businessName: "Harbor Home HVAC",
  businessDescription: "Residential HVAC services.",
  greeting: "Hi there.",
  language: "en-US",
  timezone: "America/New_York",
  answerTiming: "every_call",
  capabilities: ["answer_questions"],
  collectFields: ["name"],
  voiceId: "cgSgspJ2msm6clMCkdW9",
  advanced: {
    receptionistWizard: {
      voiceSpeed: 1.1,
      elevenLabsStability: 0.45,
      elevenLabsClarity: 0.75,
      elevenLabsStyle: 0.1,
      elevenLabsSpeakerBoost: false,
    },
  },
});

assert.equal(snapshot.voiceSpeed, 1.1);
assert.equal(snapshot.elevenLabsStability, 0.45);
assert.equal(snapshot.elevenLabsSimilarityBoost, 0.75);
assert.equal(snapshot.elevenLabsStyle, 0.1);
assert.equal(snapshot.elevenLabsSpeakerBoost, false);

const fromConfig = resolveElevenLabsTuningFromVoiceConfig({
  voiceLanguage: {
    speed: snapshot.voiceSpeed,
    elevenLabsStability: snapshot.elevenLabsStability,
    elevenLabsSimilarityBoost: snapshot.elevenLabsSimilarityBoost,
    elevenLabsStyle: snapshot.elevenLabsStyle,
    elevenLabsSpeakerBoost: snapshot.elevenLabsSpeakerBoost,
  },
});
assert.equal(fromConfig.speed, 1.1);
assert.equal(fromConfig.stability, 0.45);

assert.ok(TRANSOVO_RECEPTIONIST_CONSTITUTION.includes("Write for spoken delivery"));

console.log("test-receptionist-voice-tuning: ok");
