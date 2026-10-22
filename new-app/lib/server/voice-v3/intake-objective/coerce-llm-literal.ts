import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";

const PLACEHOLDER_LITERALS = new Set([
  "null",
  "none",
  "n/a",
  "na",
  "undefined",
  "unknown",
  "not provided",
  "not applicable",
]);

/** Model sometimes emits JSON-null semantics as strings under strict tool schemas. */
export function isLlmPlaceholderString(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_LITERALS.has(lower)) return true;
  // Single punctuation / stray JSON token (e.g. "}") — not a phone number.
  if (trimmed.length <= 2 && !/\d/.test(trimmed)) return true;
  return false;
}

/**
 * Optional tool phone argument: drop placeholders and normalize spoken US numbers to E.164.
 * Returns undefined when the model should have omitted the field (use ANI / intake fallback).
 */
export function coerceOptionalToolPhoneArg(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw === null || raw === undefined) return raw;
  if (isLlmPlaceholderString(raw)) return undefined;
  const normalized = normalizePhoneE164(raw);
  return normalized ?? undefined;
}
