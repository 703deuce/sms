import { normalizeWord, parsePhoneDigits, wordToKeypadDigits } from "./keypad";

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

function parseTelnyxVanityIfValid(
  telnyxVanity: string,
  phoneNumber: string,
): string | undefined {
  if (!vanityHasLetters(telnyxVanity)) return undefined;
  const stripped = telnyxVanity.replace(/-/g, "").replace(/\s/g, "");
  if (stripped.length !== 10) return undefined;

  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return undefined;
  const area = digits10.slice(0, 3);
  if (!stripped.startsWith(area)) return undefined;

  return telnyxVanity.trim();
}

/** Build marketing vanity display (e.g. 240-20-SPARK) from matched words. */
export function buildVanityDisplay(
  phoneNumber: string,
  matchedWords: string[],
  telnyxVanityFormat?: string,
): string | undefined {
  const telnyx = telnyxVanityFormat?.trim();
  if (telnyx) {
    const parsed = parseTelnyxVanityIfValid(telnyx, phoneNumber);
    if (parsed) return parsed;
  }

  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10 || !matchedWords.length) return undefined;

  const area = digits10.slice(0, 3);
  const subscriber = digits10.slice(3);

  const words = [...matchedWords].sort(
    (a, b) => normalizeWord(b).length - normalizeWord(a).length,
  );

  for (const word of words) {
    const vanity = buildTenCharVanity(area, subscriber, word);
    if (vanity) return vanity;
  }

  return undefined;
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
