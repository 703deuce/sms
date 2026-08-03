/**
 * Speech-friendly normalization for Flash / live TTS.
 * Does not mutate stored customer records — only outbound spoken text.
 */

const PHONE_RE =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const CURRENCY_RE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\$\s?\d+(?:\.\d{2})?\b/g;
const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\s?(AM|PM|am|pm|A\.M\.|P\.M\.)\b/g;

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

/**
 * Normalize structured tokens (phones, emails, times, currency) for Flash TTS.
 * Leaves ordinary prose alone.
 */
export function normalizeTtsTextForFlash(input: string): string {
  let text = String(input || "");
  text = text.replace(EMAIL_RE, (m) => speakEmail(m));
  text = text.replace(PHONE_RE, (m) => digitsSpoken(m, 3));
  text = text.replace(TIME_RE, (_m, h, min, mer) => speakTime(h, min, mer));
  text = text.replace(CURRENCY_RE, (m) => speakCurrency(m));
  return text;
}

/** Apply Flash normalization only when the model is Flash. */
export function maybeNormalizeForElevenLabsModel(
  text: string,
  modelId: string | undefined | null,
): string {
  if (String(modelId || "") === "eleven_flash_v2_5") {
    return normalizeTtsTextForFlash(text);
  }
  return text;
}
