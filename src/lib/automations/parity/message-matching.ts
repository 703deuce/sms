/**
 * Shared inbound message matching for triggers and wait-for-reply nodes.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL_RE = /https?:\/\/\S+/i;
const NUMBER_RE = /-?\d+(?:\.\d+)?/;

export type MessageMatchConfig = {
  matchType?: string;
  matchValue?: string;
  caseSensitive?: boolean;
};

export type MessageMatchResult = {
  matched: boolean;
  extractedEmail?: string;
  extractedPhone?: string;
  extractedUrl?: string;
  extractedNumber?: string;
  yesNo?: "yes" | "no" | "other";
};

function norm(text: string, caseSensitive?: boolean): string {
  return caseSensitive ? text : text.toLowerCase();
}

export function matchInboundMessage(
  body: string,
  config: MessageMatchConfig,
): MessageMatchResult {
  const matchType = String(config.matchType || "any");
  const raw = body || "";
  const text = norm(raw.trim(), config.caseSensitive);
  const value = norm(String(config.matchValue || "").trim(), config.caseSensitive);

  if (matchType === "any") {
    return { matched: raw.trim().length > 0 };
  }
  if (matchType === "exact") {
    return { matched: text === value };
  }
  if (matchType === "contains") {
    return { matched: value.length > 0 && text.includes(value) };
  }
  if (matchType === "starts_with") {
    return { matched: value.length > 0 && text.startsWith(value) };
  }
  if (matchType === "keyword") {
    const words = text.split(/\s+/);
    return { matched: value.length > 0 && words.includes(value) };
  }
  if (matchType === "email") {
    const m = raw.match(EMAIL_RE);
    return { matched: Boolean(m), extractedEmail: m?.[0] };
  }
  if (matchType === "phone") {
    const m = raw.match(PHONE_RE);
    return { matched: Boolean(m), extractedPhone: m?.[0] };
  }
  if (matchType === "url") {
    const m = raw.match(URL_RE);
    return { matched: Boolean(m), extractedUrl: m?.[0] };
  }
  if (matchType === "number") {
    const m = raw.match(NUMBER_RE);
    return { matched: Boolean(m), extractedNumber: m?.[0] };
  }
  if (matchType === "yes_no") {
    const yes = ["yes", "y", "yeah", "yep", "sure", "ok", "okay"];
    const no = ["no", "n", "nope", "nah"];
    if (yes.includes(text)) return { matched: true, yesNo: "yes" };
    if (no.includes(text)) return { matched: true, yesNo: "no" };
    return { matched: raw.trim().length > 0, yesNo: "other" };
  }
  if (matchType === "pattern" && value) {
    try {
      const flags = config.caseSensitive ? "" : "i";
      const re = new RegExp(value, flags);
      return { matched: re.test(raw) };
    } catch {
      return { matched: false };
    }
  }
  return { matched: false };
}

/** Map wait-for-reply match result to outcome handle. */
export function waitForReplyOutcome(
  config: MessageMatchConfig,
  match: MessageMatchResult,
  timedOut: boolean,
): string {
  if (timedOut) return "no_reply";
  const matchType = String(config.matchType || "any");
  if (matchType === "email") {
    return match.extractedEmail ? "email_found" : "reply_no_email";
  }
  if (matchType === "keyword") {
    return match.matched ? "keyword_matched" : "different_reply";
  }
  if (matchType === "yes_no") {
    if (match.yesNo === "yes") return "yes";
    if (match.yesNo === "no") return "no";
    return "other_reply";
  }
  return match.matched ? "reply_received" : "no_reply";
}
