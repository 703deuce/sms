import { normalizeWord, parsePhoneDigits, wordToKeypadDigits } from "./keypad";

const LETTER_TO_DIGIT: Record<string, string> = {
  A: "2",
  B: "2",
  C: "2",
  D: "3",
  E: "3",
  F: "3",
  G: "4",
  H: "4",
  I: "4",
  J: "5",
  K: "5",
  L: "5",
  M: "6",
  N: "6",
  O: "6",
  P: "7",
  Q: "7",
  R: "7",
  S: "7",
  T: "8",
  U: "8",
  V: "8",
  W: "9",
  X: "9",
  Y: "9",
  Z: "9",
};

export type WordPlacement = "ending" | "embedded";

function vanityHasLetters(value: string): boolean {
  return /[A-Z]/i.test(value);
}

/** Digits + letters in vanity (hyphens excluded) must equal 10 for US numbers. */
export function vanityCharacterCount(parts: {
  area: string;
  digitPrefix: string;
  word: string;
  digitSuffix?: string;
}): number {
  return (
    parts.area.length +
    parts.digitPrefix.length +
    parts.word.length +
    (parts.digitSuffix?.length ?? 0)
  );
}

/**
 * Every letter in the vanity must map to the matching phone digit at the same position.
 */
export function vanityAlignsWithPhone(vanity: string, phoneNumber: string): boolean {
  const vanityChars = vanity.replace(/-/g, "").replace(/\s/g, "");
  const digits10 = parsePhoneDigits(phoneNumber);
  if (vanityChars.length !== 10 || digits10.length !== 10) return false;

  let phoneIndex = 0;
  for (const ch of vanityChars) {
    if (phoneIndex >= 10) return false;
    if (/[0-9]/.test(ch)) {
      if (ch !== digits10[phoneIndex]) return false;
      phoneIndex += 1;
      continue;
    }
    if (/[A-Z]/i.test(ch)) {
      const digit = LETTER_TO_DIGIT[ch.toUpperCase()];
      if (!digit || digit !== digits10[phoneIndex]) return false;
      phoneIndex += 1;
      continue;
    }
    return false;
  }
  return phoneIndex === 10;
}

function formatVanityParts(
  area: string,
  digitPrefix: string,
  word: string,
  digitSuffix: string,
): string {
  const parts: string[] = [area];
  if (digitPrefix) parts.push(digitPrefix);
  parts.push(word);
  if (digitSuffix) parts.push(digitSuffix);
  return parts.join("-");
}

type SubscriberWordSpan = {
  prefix: string;
  suffix: string;
  placement: WordPlacement;
};

function findSubscriberWordSpan(subscriber: string, word: string): SubscriberWordSpan | undefined {
  const wordNorm = normalizeWord(word);
  const wordDigits = wordToKeypadDigits(wordNorm);
  if (wordDigits.length < 3) return undefined;

  const idx = subscriber.indexOf(wordDigits);
  if (idx < 0) return undefined;

  const end = idx + wordDigits.length;
  if (subscriber.slice(idx, end) !== wordDigits) return undefined;

  const prefix = subscriber.slice(0, idx);
  const suffix = subscriber.slice(end);
  const placement: WordPlacement = end >= subscriber.length ? "ending" : "embedded";

  return { prefix, suffix, placement };
}

function buildVanityFromSpan(
  area: string,
  subscriber: string,
  word: string,
  span: SubscriberWordSpan,
): string | undefined {
  const wordNorm = normalizeWord(word);
  const charCount = vanityCharacterCount({
    area,
    digitPrefix: span.prefix,
    word: wordNorm,
    digitSuffix: span.suffix,
  });
  if (charCount !== 10) return undefined;

  // Re-verify subscriber reconstruction
  const wordDigits = wordToKeypadDigits(wordNorm);
  if (span.prefix + wordDigits + span.suffix !== subscriber) return undefined;

  return formatVanityParts(area, span.prefix, wordNorm, span.suffix);
}

/**
 * Build vanity like 240-20-SPARK (word at end) or 757-LAWN-262 (word embedded).
 */
function buildVanityForWord(area: string, subscriber: string, word: string): string | undefined {
  const span = findSubscriberWordSpan(subscriber, word);
  if (!span) return undefined;
  return buildVanityFromSpan(area, subscriber, word, span);
}

/** Words that can be shown as trailing letters at the end of the vanity. */
export function pickEndingVanityWords(phoneNumber: string, matchedWords: string[]): string[] {
  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return [];

  const subscriber = digits10.slice(3);
  const ending = matchedWords.filter((word) => {
    const span = findSubscriberWordSpan(subscriber, word);
    return span?.placement === "ending";
  });

  return [...new Set(ending.map((w) => normalizeWord(w)))].sort(
    (a, b) => b.length - a.length,
  );
}

/** Words embedded in the subscriber with digits after the keyword letters. */
export function pickEmbeddedVanityWords(phoneNumber: string, matchedWords: string[]): string[] {
  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return [];

  const subscriber = digits10.slice(3);
  const embedded = matchedWords.filter((word) => {
    const span = findSubscriberWordSpan(subscriber, word);
    return span?.placement === "embedded";
  });

  return [...new Set(embedded.map((w) => normalizeWord(w)))].sort(
    (a, b) => b.length - a.length,
  );
}

/** @deprecated Use pickEndingVanityWords */
export function pickVanityDisplayWords(phoneNumber: string, matchedWords: string[]): string[] {
  return pickEndingVanityWords(phoneNumber, matchedWords);
}

function extractDisplayWordFromAlignedVanity(
  vanity: string,
  phoneNumber: string,
): { word: string; placement: WordPlacement } | undefined {
  if (!vanityAlignsWithPhone(vanity, phoneNumber)) return undefined;

  const vanityChars = vanity.replace(/-/g, "").replace(/\s/g, "");
  const runs: { word: string; length: number }[] = [];

  let i = 0;
  while (i < vanityChars.length) {
    if (/[A-Z]/i.test(vanityChars[i])) {
      let j = i;
      while (j < vanityChars.length && /[A-Z]/i.test(vanityChars[j])) j += 1;
      const word = normalizeWord(vanityChars.slice(i, j));
      if (word.length >= 3) runs.push({ word, length: word.length });
      i = j;
    } else {
      i += 1;
    }
  }

  const best = runs.sort((a, b) => b.length - a.length)[0];
  if (!best) return undefined;

  const subscriber = parsePhoneDigits(phoneNumber).slice(3);
  const wordDigits = wordToKeypadDigits(best.word);
  const placement: WordPlacement = subscriber.endsWith(wordDigits) ? "ending" : "embedded";
  return { word: best.word, placement };
}

export type VanityPresentation = {
  vanityDisplay?: string;
  /** Word shown as letters in vanityDisplay. */
  displayWord?: string;
  wordPlacement?: WordPlacement;
};

/**
 * Resolve customer-facing vanity + the word letters actually shown.
 * Prefers exact-ending words (premium); falls back to embedded keyword spans.
 */
export function resolveVanityPresentation(
  phoneNumber: string,
  matchedWords: string[],
  telnyxVanityFormat?: string,
): VanityPresentation {
  const telnyx = telnyxVanityFormat?.trim();
  if (telnyx && vanityHasLetters(telnyx)) {
    const extracted = extractDisplayWordFromAlignedVanity(telnyx, phoneNumber);
    if (extracted) {
      const span = findSubscriberWordSpan(
        parsePhoneDigits(phoneNumber).slice(3),
        extracted.word,
      );
      if (span && buildVanityFromSpan(
        parsePhoneDigits(phoneNumber).slice(0, 3),
        parsePhoneDigits(phoneNumber).slice(3),
        extracted.word,
        span,
      )) {
        return {
          vanityDisplay: telnyx,
          displayWord: extracted.word,
          wordPlacement: extracted.placement,
        };
      }
    }
  }

  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return {};

  const area = digits10.slice(0, 3);
  const subscriber = digits10.slice(3);

  for (const word of pickEndingVanityWords(phoneNumber, matchedWords)) {
    const vanity = buildVanityForWord(area, subscriber, word);
    if (vanity) {
      return { vanityDisplay: vanity, displayWord: word, wordPlacement: "ending" };
    }
  }

  for (const word of pickEmbeddedVanityWords(phoneNumber, matchedWords)) {
    const vanity = buildVanityForWord(area, subscriber, word);
    if (vanity) {
      return { vanityDisplay: vanity, displayWord: word, wordPlacement: "embedded" };
    }
  }

  return {};
}

/** Build marketing vanity display (e.g. 240-20-SPARK) from matched words. */
export function buildVanityDisplay(
  phoneNumber: string,
  matchedWords: string[],
  telnyxVanityFormat?: string,
): string | undefined {
  return resolveVanityPresentation(phoneNumber, matchedWords, telnyxVanityFormat).vanityDisplay;
}

export function starRatingFromScores(
  businessMatchScore: number,
  numberQualityScore: number,
): number {
  const peak = Math.max(businessMatchScore, numberQualityScore);
  if (peak >= 80) return 5;
  if (peak >= 65) return 4;
  if (peak >= 45) return 3;
  if (peak >= 25) return 2;
  return 1;
}
