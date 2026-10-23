/** Shared phone detection for content script and unit tests (M83). */
const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

export function findPhoneNumbersInText(text) {
  const out = [];
  if (!text) return out;
  let m;
  const re = new RegExp(PHONE_RE.source, PHONE_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].trim();
    if (raw.length >= 10) out.push(raw);
  }
  return out;
}

export function normalizeDigits(phone) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (phone.startsWith("+")) return `+${d}`;
  return `+${d}`;
}
