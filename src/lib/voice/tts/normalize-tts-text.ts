/**
 * Speech-friendly normalization before TTS synthesis.
 * Does not mutate stored customer records — outbound spoken text only.
 */

const PHONE_RE =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
const CURRENCY_RE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\$\s?\d+(?:\.\d{2})?\b/g;
const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\s?(AM|PM|am|pm|A\.M\.|P\.M\.)\b/g;
const DATE_RE =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi;

const ACRONYM_REPLACEMENTS: Record<string, string> = {
  HVAC: "H V A C",
  FAQ: "F A Q",
  SMS: "S M S",
  AM: "A M",
  PM: "P M",
};

const DIGIT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

function digitsSpoken(digits: string, groupSize = 3): string {
  const only = digits.replace(/\D/g, "");
  const parts: string[] = [];
  for (let i = 0; i < only.length; i += groupSize) {
    const chunk = only.slice(i, i + groupSize);
    parts.push(
      chunk
        .split("")
        .map((d) => DIGIT_WORDS[Number(d)] || d)
        .join(" "),
    );
  }
  return parts.join(", ");
}

function speakTime(hourRaw: string, minute: string, meridiem: string): string {
  const hour = Number(hourRaw);
  const min = Number(minute);
  const mer = meridiem.replace(/\./g, "").toUpperCase();
  const merSpoken = mer.startsWith("A") ? "A.M." : "P.M.";
  if (min === 0) return `${hour} ${merSpoken}`;
  if (min < 10) return `${hour} oh ${DIGIT_WORDS[min]} ${merSpoken}`;
  return `${hour} ${minute} ${merSpoken}`;
}

function speakCurrency(raw: string): string {
  const n = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return raw;
  const dollars = Math.floor(n);
  const cents = Math.round((n - dollars) * 100);
  if (cents === 0) return `${dollars} dollars`;
  return `${dollars} dollars and ${cents} cents`;
}

function speakEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local} at ${domain.replace(/\./g, " dot ")}`;
}

function speakUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\./g, " dot ").replace(/\//g, " slash ");
}

function expandAcronyms(text: string): string {
  let out = text;
  for (const [abbr, spoken] of Object.entries(ACRONYM_REPLACEMENTS)) {
    out = out.replace(new RegExp(`\\b${abbr}\\b`, "g"), spoken);
  }
  return out;
}

function normalizeUnicodePunctuation(text: string): string {
  return text
    .replace(/\u2019/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

/**
 * Normalize structured tokens (phones, emails, times, currency, URLs) for TTS.
 */
export function normalizeTtsText(input: string): string {
  let text = normalizeUnicodePunctuation(String(input || ""));
  text = text.replace(EMAIL_RE, (m) => speakEmail(m));
  text = text.replace(URL_RE, (m) => speakUrl(m));
  text = text.replace(PHONE_RE, (m) => digitsSpoken(m, 3));
  text = text.replace(TIME_RE, (_m, h, min, mer) => speakTime(h, min, mer));
  text = text.replace(DATE_RE, (m) => m.replace(/-/g, " "));
  text = text.replace(CURRENCY_RE, (m) => speakCurrency(m));
  text = expandAcronyms(text);
  return text.replace(/\s{2,}/g, " ").trim();
}

/** Back-compat alias used by ElevenLabs Flash path. */
export const normalizeTtsTextForFlash = normalizeTtsText;

/** Apply normalization when the outbound TTS model benefits from spoken-form text. */
export function maybeNormalizeForElevenLabsModel(
  text: string,
  modelId: string | undefined | null,
): string {
  const id = String(modelId || "");
  if (id.includes("flash") || id.includes("eleven") || id.includes("ElevenLabs")) {
    return normalizeTtsText(text);
  }
  return text;
}
