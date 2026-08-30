/**
 * Regression tests for phrase chunking + TTS normalization.
 * Run: npx tsx scripts/test-tts-phrase-pipeline.ts
 */
import assert from "node:assert/strict";
import { phraseBufferStream } from "../src/lib/voice/tts/phrase-text-buffer";
import { normalizeTtsText } from "../src/lib/voice/tts/normalize-tts-text";

async function collect(source: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const phrase of source) out.push(phrase);
  return out;
}

async function streamFromChunks(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

async function main() {
  // Never split inside a word
  const wordSplit = await collect(
    phraseBufferStream(await streamFromChunks(["Your appoint", "ment is Thursday."])),
  );
  assert.ok(wordSplit.some((p) => p.includes("appointment")), wordSplit.join("|"));

  const business = await collect(
    phraseBufferStream(
      await streamFromChunks([
        "Harbor Drain Pros serves ",
        "San Francisco, Oakland, and Berkeley.",
      ]),
    ),
  );
  assert.ok(business.length >= 1);

  const phoneNorm = normalizeTtsText("Call us at 571-477-6175 for a $89 diagnostic.");
  assert.ok(phoneNorm.includes("five seven one"), phoneNorm);
  assert.ok(phoneNorm.includes("dollars"), phoneNorm);

  const emailNorm = normalizeTtsText("Email amy@harbordrainpros.com");
  assert.ok(emailNorm.includes(" at "), emailNorm);

  const timeNorm = normalizeTtsText("We're open until 6:00 PM.");
  assert.ok(timeNorm.includes("P.M."), timeNorm);

  const acronym = normalizeTtsText("Check the FAQ for HVAC service.");
  assert.ok(acronym.includes("F A Q"), acronym);

  const contraction = await collect(
    phraseBufferStream(await streamFromChunks(["We're ", "happy to help, ", "thanks!"])),
  );
  assert.ok(contraction.length >= 2);

  console.log("test-tts-phrase-pipeline: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
