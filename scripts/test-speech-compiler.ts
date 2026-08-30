/**
 * Regression tests for SpeechCompiler (semantic → speech text).
 * Run: npx tsx scripts/test-speech-compiler.ts
 */
import assert from "node:assert/strict";
import {
  compileSemanticForSpeech,
  resolveTtsCommitMode,
  speechTripleFromCanonical,
  splitSpeechSegments,
} from "../src/lib/voice/tts/speech-compiler";

function main() {
  assert.equal(resolveTtsCommitMode("Sure."), "fast");
  assert.equal(resolveTtsCommitMode("One second."), "fast");
  assert.equal(
    resolveTtsCommitMode(
      "Your appointment is scheduled for September third at two thirty P.M.",
    ),
    "fast",
  );
  assert.equal(
    resolveTtsCommitMode(
      "I can help with that — let me walk through the options and explain what we offer in your area.",
    ),
    "contextual",
  );

  const compiled = compileSemanticForSpeech(
    "Call us at 555-555-0123. The estimate is $1,250.",
  );
  assert.ok(compiled.speechText.includes("five five five"), compiled.speechText);
  assert.ok(compiled.speechText.includes("dollars"), compiled.speechText);
  assert.equal(compiled.semanticText.includes("555"), true);
  assert.ok(compiled.segments.length >= 1);

  const segments = splitSpeechSegments("First sentence. Second sentence!");
  assert.deepEqual(segments, ["First sentence.", "Second sentence!"]);

  const triple = speechTripleFromCanonical(
    "+15555550123",
    "(555) 555-0123",
  );
  assert.equal(triple.canonical, "+15555550123");
  assert.equal(triple.display, "(555) 555-0123");
  assert.ok(triple.speech.includes("five five five"), triple.speech);

  console.log("test-speech-compiler: PASS");
}

main();
