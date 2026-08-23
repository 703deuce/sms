/**
 * Normalize secrets from Coolify / Docker / dotenv UIs.
 * Trailing newlines and wrapping quotes are a common source of
 * "Key not found" / unauthorized provider failures.
 */
export function cleanSecret(value: string | undefined | null): string | null {
  if (value == null) return null;
  let v = String(value).trim();
  if (!v) return null;
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  // Strip accidental BOM / zero-width chars from copy-paste.
  v = v.replace(/^[\uFEFF\u200B]+/, "").replace(/[\u200B]+$/g, "").trim();
  return v || null;
}

/** Safe fingerprint for logs — never log the full secret. */
export function secretFingerprint(value: string | null | undefined): {
  present: boolean;
  length: number;
  prefix: string;
  suffix: string;
  hadWhitespace: boolean;
} {
  const raw = value == null ? "" : String(value);
  const cleaned = cleanSecret(value);
  return {
    present: Boolean(cleaned),
    length: cleaned?.length ?? 0,
    prefix: cleaned ? cleaned.slice(0, 4) : "",
    suffix: cleaned && cleaned.length > 4 ? cleaned.slice(-4) : "",
    hadWhitespace: Boolean(raw && cleaned && raw !== cleaned),
  };
}
