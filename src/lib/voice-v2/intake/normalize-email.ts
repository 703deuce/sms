/** Shared email normalization for PSTN/LLM intake (no server-only — safe for tests). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_PREFIX_RE =
  /^(?:my\s+)?(?:e\s*-?\s*mail(?:\s+address)?\s+is|email\s+is|it's|it is|the email is)\s+/i;

/** Collapse STT like "l o n g h p" → "longhp" while keeping "g mail" as two tokens until dot/at rules run. */
function collapseSpelledToken(part: string): string {
  let p = part.trim();
  if (!p) return "";
  if (p.includes("@")) return p.replace(/\s+/g, "");
  const tokens = p.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return p.replace(/\s+/g, "");
  const allShort = tokens.every((t) => t.length === 1 && /[a-z0-9]/i.test(t));
  if (allShort) return tokens.join("");
  return tokens.join("");
}

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
      const local = collapseSpelledToken(s.slice(0, at));
      const domain = collapseSpelledToken(s.slice(at + 1));
      s = `${local}@${domain}`;
    } else {
      s = collapseSpelledToken(s);
    }
  } else {
    s = collapseSpelledToken(s);
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
