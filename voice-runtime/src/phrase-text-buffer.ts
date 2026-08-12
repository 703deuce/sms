/**
 * Buffers incremental LLM text into short phrases for low-latency TTS streaming.
 * Flushes on punctuation boundaries or when max word count is reached — never per token.
 */
export type PhraseTextBufferOptions = {
  /** Minimum characters before a punctuation flush is considered. */
  minChars?: number;
  /** Force flush once this many words accumulate. */
  maxWords?: number;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ensureTrailingSpace(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.endsWith(" ") ? trimmed : `${trimmed} `;
}

/**
 * Find the first punctuation break meeting per-punctuation minimum length.
 */
function findPunctuationBreak(text: string, minChars: number): number | null {
  const rules: Array<{ re: RegExp; min: number }> = [
    { re: /[.!?…]/g, min: minChars },
    { re: /[,—–]/g, min: Math.min(4, minChars) },
  ];

  let best: number | null = null;
  for (const { re, min } of rules) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const end = match.index + 1;
      if (end >= min) {
        if (best === null || end < best) {
          best = end;
        }
        break;
      }
    }
  }
  return best;
}

function tryFlushPhrase(
  buffer: string,
  options: PhraseTextBufferOptions,
): { phrase: string; rest: string } | null {
  const minChars = options.minChars ?? 12;
  const maxWords = options.maxWords ?? 10;
  const trimmedStart = buffer.trimStart();
  const leading = buffer.length - trimmedStart.length;
  if (!trimmedStart.trim()) return null;

  const words = trimmedStart.trim().split(/\s+/);
  if (words.length >= maxWords) {
    let consumed = leading;
    let pos = leading;
    for (let i = 0; i < maxWords; i += 1) {
      const word = words[i];
      const idx = buffer.indexOf(word, pos);
      if (idx < 0) break;
      pos = idx + word.length;
      consumed = pos;
    }
    const phrase = buffer.slice(leading, consumed).trim();
    const rest = buffer.slice(consumed);
    if (!phrase) return null;
    return { phrase: ensureTrailingSpace(phrase), rest };
  }

  if (trimmedStart.length < minChars) return null;

  const punctEnd = findPunctuationBreak(trimmedStart, minChars);
  if (punctEnd == null) return null;

  const phrase = trimmedStart.slice(0, punctEnd).trim();
  const rest = trimmedStart.slice(punctEnd);
  if (!phrase) return null;
  return { phrase: ensureTrailingSpace(phrase), rest: leading > 0 ? buffer.slice(0, leading) + rest : rest };
}

export async function* phraseBufferStream(
  source: AsyncIterable<string>,
  options: PhraseTextBufferOptions = {},
): AsyncGenerator<string> {
  let buffer = "";

  for await (const chunk of source) {
    if (!chunk) continue;
    buffer += chunk;

    while (true) {
      const flushed = tryFlushPhrase(buffer, options);
      if (!flushed) break;
      buffer = flushed.rest;
      yield flushed.phrase;
    }
  }

  const remainder = buffer.trim();
  if (remainder) {
    yield ensureTrailingSpace(remainder);
  }
}
