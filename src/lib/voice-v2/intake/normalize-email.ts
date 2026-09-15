/** Shared email normalization for PSTN/LLM intake (no server-only — safe for tests). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_PREFIX_RE =
  /^(?:my\s+)?(?:e\s*-?\s*mail(?:\s+address)?\s+is|email\s+is|it's|it is|the email is)\s+/i;

/**
 * Turn spoken or messy STT email into a deliverable address when possible.
 * Examples: "anthony at gmail dot com", "a n t h o n y at g mail dot com"
 */
export function normalizeVoiceIntakeEmail(raw: string): string | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;

  s = s.replace(EMAIL_PREFIX_RE, "").trim();
  s = s.replace(/[.,;!?]+$/g, "").trim();

  const looksSpoken =
    /\b(at|dot)\b/i.test(s) || (s.includes(" ") && !s.includes("@"));

  if (looksSpoken) {
    s = s
      .replace(/\s+at\s+/gi, "@")
      .replace(/\s+dot\s+/gi, ".")
      .replace(/\s*@\s*/g, "@");
    if (!s.includes("@")) {
      s = s.replace(/\bat\b/gi, "@").replace(/\bdot\b/gi, ".");
    }
    if (s.includes("@")) {
      const at = s.indexOf("@");
      const local = s.slice(0, at).replace(/\s+/g, "");
      const domain = s.slice(at + 1).replace(/\s+/g, "");
      s = `${local}@${domain}`;
    } else {
      s = s.replace(/\s+/g, "");
    }
  } else {
    s = s.replace(/\s+/g, "");
  }

  s = s.toLowerCase();

  if (!EMAIL_RE.test(s)) return null;
  return s;
}

export function isValidIntakeEmail(raw: string): boolean {
  const trimmed = String(raw ?? "").trim();
  if (EMAIL_RE.test(trimmed)) return true;
  return normalizeVoiceIntakeEmail(trimmed) !== null;
}
