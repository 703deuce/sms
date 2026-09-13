/**
 * Canonical SMS segment / encoding analysis for outbound text.
 * GSM-7: 160 single / 153 per concatenated segment.
 * UCS-2: 70 single / 67 per concatenated segment.
 *
 * Encoding rule matches mass-texting (`estimateSmsSegments`): any non-ASCII → UCS-2.
 */

export type SmsEncoding = "GSM7" | "UCS2";

export type SmsBodyAnalysis = {
  characterCount: number;
  encoding: SmsEncoding;
  segmentCount: number;
  /** UCS-2 used but message could be GSM-7 after normalizing decorative punctuation. */
  unnecessaryUcs2: boolean;
};

const DECORATIVE_UNICODE_RE =
  /[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0]|[\u{1F300}-\u{1FAFF}]/u;

function isAsciiGsmCompatible(text: string): boolean {
  return !/[^\x00-\x7F]/.test(text);
}

function segmentCountForEncoding(charCount: number, encoding: SmsEncoding): number {
  if (charCount === 0) return 0;
  const single = encoding === "GSM7" ? 160 : 70;
  const concat = encoding === "GSM7" ? 153 : 67;
  if (charCount <= single) return 1;
  return Math.ceil(charCount / concat);
}

/** Prefer GSM-7 for English business SMS — decorative punctuation only. */
export function normalizeSmsToGsm7Preferred(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

export function analyzeSmsBody(body: string): SmsBodyAnalysis {
  const characterCount = body.length;
  if (characterCount === 0) {
    return { characterCount: 0, encoding: "GSM7", segmentCount: 0, unnecessaryUcs2: false };
  }
  const encoding: SmsEncoding = isAsciiGsmCompatible(body) ? "GSM7" : "UCS2";
  const segmentCount = segmentCountForEncoding(characterCount, encoding);
  const unnecessaryUcs2 =
    encoding === "UCS2" &&
    isAsciiGsmCompatible(normalizeSmsToGsm7Preferred(body)) &&
    (DECORATIVE_UNICODE_RE.test(body) || body !== normalizeSmsToGsm7Preferred(body));

  return {
    characterCount,
    encoding,
    segmentCount,
    unnecessaryUcs2,
  };
}

export function estimateSmsSegmentsFromAnalysis(body: string) {
  const a = analyzeSmsBody(body);
  return { characters: a.characterCount, segments: a.segmentCount, encoding: a.encoding };
}
