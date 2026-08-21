/**
 * Basic caller-ID / robocall heuristics for MCTB eligibility.
 * Blocks anonymous, invalid, and obvious machine-traffic patterns before SMS spend.
 */

const ANONYMOUS_PATTERNS = new Set([
  "+266696687", // AT&T anonymous
  "+2562533", // Verizon anonymous
  "+8656696", // T-Mobile anonymous
  "+0000000000",
  "+1111111111",
]);

const BLOCKED_LABELS = ["anonymous", "private", "blocked", "restricted", "unknown", "unavailable"];

export type SpamFilterResult = {
  blocked: boolean;
  reason: "INVALID_PHONE" | "UNKNOWN_CALLER" | "SPAM" | null;
  detail?: string;
};

export function evaluateCallerIdForMctb(callerE164: string): SpamFilterResult {
  const raw = String(callerE164 || "").trim();
  if (!raw) {
    return { blocked: true, reason: "UNKNOWN_CALLER", detail: "empty_caller_id" };
  }

  const upper = raw.toUpperCase();
  if (BLOCKED_LABELS.some((label) => upper.includes(label))) {
    return { blocked: true, reason: "UNKNOWN_CALLER", detail: "blocked_label" };
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) {
    return { blocked: true, reason: "INVALID_PHONE", detail: "too_short" };
  }

  const normalized = raw.startsWith("+") ? raw : `+${digits}`;
  if (ANONYMOUS_PATTERNS.has(normalized)) {
    return { blocked: true, reason: "UNKNOWN_CALLER", detail: "anonymous_ani" };
  }

  // Repeated-digit garbage (e.g. +10000000000)
  if (/^\+?1?0{7,}$/.test(digits) || /^(\d)\1{9,}$/.test(digits)) {
    return { blocked: true, reason: "SPAM", detail: "repeated_digits" };
  }

  return { blocked: false, reason: null };
}
