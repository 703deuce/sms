/**
 * Unit tests for phrase text buffering (Realtime → ElevenLabs hybrid).
 * Run: npx tsx scripts/test-phrase-text-buffer.ts
 */
import assert from "node:assert/strict";
import { phraseBufferStream } from "../voice-runtime/src/phrase-text-buffer";

async function collect(source: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const phrase of source) {
    out.push(phrase);
  }
  return out;
}

async function streamFromChunks(chunks: string[]): Promise<AsyncIterable<string>> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

async function main() {
  const punct = await collect(
    phraseBufferStream(
      await streamFromChunks(["Absolutely", ", I can help with that. ", "What's your name?"]),
    ),
  );
  assert.equal(punct.length, 3);
  assert.equal(punct[0], "Absolutely, ");
  assert.equal(punct[1], "I can help with that. ");
  assert.equal(punct[2], "What's your name? ");

  const maxWords = await collect(
    phraseBufferStream(await streamFromChunks(["one two three four five six seven eight nine ten"]),
      { maxWords: 4, minChars: 1 },
    ),
  );
  assert.equal(maxWords.length, 3);
  assert.equal(maxWords[0], "one two three four ");
  assert.equal(maxWords[1], "five six seven eight ");
  assert.equal(maxWords[2], "nine ten ");

  const remainder = await collect(phraseBufferStream(await streamFromChunks(["Hello"])));
  assert.deepEqual(remainder, ["Hello "]);

  console.log("test-phrase-text-buffer: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
