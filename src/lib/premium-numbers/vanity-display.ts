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

function vanityHasLetters(value: string): boolean {
  return /[A-Z]/i.test(value);
}

/** Digits + letters in vanity (hyphens excluded) must equal 10 for US numbers. */
export function vanityCharacterCount(parts: {
  area: string;
  digitPrefix: string;
  word: string;
}): number {
  return parts.area.length + parts.digitPrefix.length + parts.word.length;
}

function isTenCharacterVanity(area: string, digitPrefix: string, word: string): boolean {
  return vanityCharacterCount({ area, digitPrefix, word }) === 10;
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

/** Words that can be shown as trailing letters in a 10-character vanity display. */
export function pickVanityDisplayWords(phoneNumber: string, matchedWords: string[]): string[] {
  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return [];

  const area = digits10.slice(0, 3);
  const subscriber = digits10.slice(3);
  const displayable = matchedWords.filter((word) =>
    Boolean(buildTenCharVanity(area, subscriber, word)),
  );

  return [...new Set(displayable.map((w) => normalizeWord(w)))].sort(
    (a, b) => b.length - a.length,
  );
}

function extractTrailingWordFromVanity(vanity: string): string | undefined {
  const parts = vanity.split("-").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || !/^[A-Z]+$/i.test(last)) return undefined;
  return normalizeWord(last);
}

/**
 * Build vanity like 240-20-SPARK or 240-91-VOLTS:
 * 3-digit area + remaining digit prefix + word letters = 10 characters total.
 */
function buildTenCharVanity(
  area: string,
  subscriber: string,
  word: string,
): string | undefined {
  const wordNorm = normalizeWord(word);
  const wordLen = wordNorm.length;
  if (wordLen < 3 || wordLen > 7) return undefined;

  const wordDigits = wordToKeypadDigits(wordNorm);
  if (wordDigits.length < 3) return undefined;

  const digitPrefixLen = 7 - wordLen;
  if (digitPrefixLen < 0) return undefined;

  const digitPrefix = subscriber.slice(0, digitPrefixLen);
  const suffixDigits = subscriber.slice(digitPrefixLen);

  if (suffixDigits !== wordDigits) return undefined;
  if (!isTenCharacterVanity(area, digitPrefix, wordNorm)) return undefined;

  if (digitPrefixLen === 0) {
    return `${area}-${wordNorm}`;
  }
  return `${area}-${digitPrefix}-${wordNorm}`;
}

export type VanityPresentation = {
  vanityDisplay?: string;
  /** Word shown as letters in vanityDisplay — must map to ending digits. */
  displayWord?: string;
};

/**
 * Resolve customer-facing vanity + the word letters actually shown.
 * Only exact-ending keypad matches are eligible; Telnyx vanity must align with digits.
 */
export function resolveVanityPresentation(
  phoneNumber: string,
  matchedWords: string[],
  telnyxVanityFormat?: string,
): VanityPresentation {
  const telnyx = telnyxVanityFormat?.trim();
  if (telnyx && vanityHasLetters(telnyx) && vanityAlignsWithPhone(telnyx, phoneNumber)) {
    const candidateWord = extractTrailingWordFromVanity(telnyx);
    if (
      candidateWord &&
      pickVanityDisplayWords(phoneNumber, [candidateWord]).includes(candidateWord)
    ) {
      return { vanityDisplay: telnyx, displayWord: candidateWord };
    }
  }

  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return {};

  const area = digits10.slice(0, 3);
  const subscriber = digits10.slice(3);
  const exactWords = pickVanityDisplayWords(phoneNumber, matchedWords);

  for (const word of exactWords) {
    const vanity = buildTenCharVanity(area, subscriber, word);
    if (vanity) return { vanityDisplay: vanity, displayWord: word };
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
