import { formatUsPhone, parsePhoneDigits, wordToKeypadDigits } from "./keypad";

/** Build marketing vanity display (e.g. 571-727-PLUMB) from matched words. */
export function buildVanityDisplay(
  phoneNumber: string,
  matchedWords: string[],
  telnyxVanityFormat?: string,
): string | undefined {
  if (telnyxVanityFormat?.trim()) {
    return telnyxVanityFormat.trim();
  }

  const digits10 = parsePhoneDigits(phoneNumber);
  if (digits10.length !== 10) return undefined;
  const subscriber = digits10.slice(3);

  let best: { word: string; digits: string } | null = null;
  for (const word of matchedWords) {
    const d = wordToKeypadDigits(word);
    if (d.length < 3) continue;
    if (subscriber.endsWith(d)) {
      if (!best || d.length > best.digits.length) best = { word, digits: d };
    }
  }
  if (!best) return undefined;

  const prefixLen = subscriber.length - best.digits.length;
  const prefix = subscriber.slice(0, prefixLen);
  const area = digits10.slice(0, 3);

  if (prefix.length >= 3) {
    const exchange = prefix.slice(0, 3);
    const mid = prefix.slice(3);
    if (mid) return `${area}-${exchange}-${mid}${best.word}`;
    return `${area}-${exchange}-${best.word}`;
  }

  return `${formatUsPhone(digits10).replace(
    subscriber.slice(-best.digits.length),
    best.word,
  )}`;
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
