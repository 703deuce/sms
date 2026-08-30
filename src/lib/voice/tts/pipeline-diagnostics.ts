/**
 * Diagnostics for LLM token stream → phrase chunks → normalized TTS text.
 * Redacts phones/emails in logs. Enable with VOICE_TTS_PIPELINE_DEBUG=1.
 */

export type TtsPipelineChunkRecord = {
  generationId: string;
  seq: number;
  rawDelta: string;
  normalizedText: string;
  ttsChunk: string;
  flushReason: "punctuation" | "max_words" | "remainder" | "passthrough";
  cancelled?: boolean;
};

let generationCounter = 0;

export function nextTtsGenerationId(prefix = "tts"): string {
  generationCounter += 1;
  return `${prefix}-${Date.now()}-${generationCounter}`;
}

function redactForLog(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .slice(0, 240);
}

export class TtsPipelineDiagnostics {
  private records: TtsPipelineChunkRecord[] = [];
  private cancelled = false;

  constructor(
    readonly generationId: string,
    private readonly enabled = process.env.VOICE_TTS_PIPELINE_DEBUG === "1",
  ) {}

  markCancelled(): void {
    this.cancelled = true;
    if (this.enabled) {
      console.log(
        JSON.stringify({
          source: "voice.tts_pipeline",
          event: "generation_cancelled",
          generationId: this.generationId,
        }),
      );
    }
  }

  record(input: Omit<TtsPipelineChunkRecord, "generationId">): void {
    const row: TtsPipelineChunkRecord = { generationId: this.generationId, ...input };
    this.records.push(row);
    if (!this.enabled) return;
    console.log(
      JSON.stringify({
        source: "voice.tts_pipeline",
        event: "tts_chunk",
        generationId: this.generationId,
        seq: row.seq,
        flushReason: row.flushReason,
        rawPreview: redactForLog(row.rawDelta),
        normalizedPreview: redactForLog(row.normalizedText),
        ttsChunkPreview: redactForLog(row.ttsChunk),
        cancelled: this.cancelled,
      }),
    );
  }

  snapshot(): TtsPipelineChunkRecord[] {
    return [...this.records];
  }
}

/**
 * Wrap a token/delta stream with phrase buffering + normalization + diagnostics.
 */
export async function* instrumentedPhraseTtsStream(input: {
  source: AsyncIterable<string>;
  normalize?: (text: string) => string;
  generationId?: string;
  phraseOptions?: import("./phrase-text-buffer").PhraseTextBufferOptions;
}): AsyncGenerator<{ raw: string; normalized: string; ttsChunk: string }> {
  const diag = new TtsPipelineDiagnostics(input.generationId || nextTtsGenerationId());
  const { phraseBufferStream } = await import("./phrase-text-buffer");
  let rawAccum = "";
  let seq = 0;

  const rawStream = (async function* () {
    for await (const delta of input.source) {
      rawAccum += delta;
      yield delta;
    }
  })();

  for await (const phrase of phraseBufferStream(rawStream, input.phraseOptions)) {
    const normalized = input.normalize ? input.normalize(phrase) : phrase;
    seq += 1;
    diag.record({
      seq,
      rawDelta: phrase,
      normalizedText: normalized,
      ttsChunk: normalized,
      flushReason: "punctuation",
    });
    yield { raw: phrase, normalized, ttsChunk: normalized };
  }

  if (rawAccum.trim() && seq === 0) {
    const normalized = input.normalize ? input.normalize(rawAccum) : rawAccum;
    diag.record({
      seq: 1,
      rawDelta: rawAccum,
      normalizedText: normalized,
      ttsChunk: normalized,
      flushReason: "remainder",
    });
    yield { raw: rawAccum, normalized, ttsChunk: normalized };
  }
}
