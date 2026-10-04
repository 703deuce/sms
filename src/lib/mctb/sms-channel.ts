/**
 * MCTB SMS channel rules — brevity and segment economics are production requirements.
 */
import type { MctbConversationTurn } from "@/lib/mctb/conversation-thread";
import { analyzeSmsBody, normalizeSmsToGsm7Preferred } from "@/lib/sms/segment-encoding";

/** Permanent instruction for any MCTB conversational / phrasing LLM. */
export const MCTB_SMS_CHANNEL_SYSTEM = `You are replying by SMS. Keep replies concise and natural. Prefer one SMS segment when practical (about 160 GSM characters for simple English). Answer directly, avoid unnecessary explanations, and never write long chatbot-style paragraphs. Ask only what is needed to move the conversation forward. Do not repeat information the customer already knows. One clear question at a time unless multiple fields fit naturally in one short message.`;

export type MctbSmsSegmentLimits = {
  /** Ordinary turns: 3+ segments is a certification failure. */
  maxSegmentsOrdinary: number;
  warnSegments: number;
};

export const DEFAULT_MCTB_SMS_LIMITS: MctbSmsSegmentLimits = {
  maxSegmentsOrdinary: 2,
  warnSegments: 3,
};

export function analyzeMctbOutboundSms(body: string) {
  return analyzeSmsBody(body);
}

/** Apply before sending MCTB automated SMS (reduces UCS-2 segment explosion). */
export function finalizeMctbOutboundSms(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return trimmed;
  return normalizeSmsToGsm7Preferred(trimmed);
}

export function isOrdinaryMctbReplyTooLong(
  body: string,
  limits: MctbSmsSegmentLimits = DEFAULT_MCTB_SMS_LIMITS,
): { fail: boolean; analysis: ReturnType<typeof analyzeSmsBody> } {
  const analysis = analyzeSmsBody(body);
  const fail = analysis.segmentCount >= limits.warnSegments;
  return { fail, analysis };
}

const TRACKING_URL_RE = /https?:\/\/[^\s]*\/r\/[a-zA-Z0-9]+/gi;
const GENERIC_URL_RE = /https?:\/\/[^\s]+/gi;

/** Strip Transovo /r/ redirect links — never customer-facing. */
export function stripMctbTrackingUrlsFromSms(body: string): string {
  return body.replace(TRACKING_URL_RE, "").replace(/\s{2,}/g, " ").trim();
}

/** Agent follow-ups: no tracking links; only an explicit booking URL may remain. */
export function stripUrlsFromMctbAgentSmsReply(
  body: string,
  allowedUrl?: string | null,
): string {
  let text = body.trim();
  if (!text) return text;

  const allowed = allowedUrl?.trim();
  text = stripMctbTrackingUrlsFromSms(text);

  if (allowed) {
    const allowedNorm = allowed.toLowerCase();
    text = text
      .replace(GENERIC_URL_RE, (url) => (url.toLowerCase() === allowedNorm ? url : ""))
      .trim();
  } else {
    text = text.replace(GENERIC_URL_RE, "").trim();
  }

  return text.replace(/\s{2,}/g, " ").replace(/\s+([.!?])/g, "$1").trim();
}

/** Hard cap for conversational agent SMS (2 GSM segments ≈ 306 chars). */
export function truncateMctbAgentSmsToSegmentBudget(
  body: string,
  limits: MctbSmsSegmentLimits = DEFAULT_MCTB_SMS_LIMITS,
): string {
  let text = finalizeMctbOutboundSms(body);
  const maxSegments = limits.maxSegmentsOrdinary;
  const analysis = analyzeSmsBody(text);
  if (analysis.segmentCount <= maxSegments) return text;

  const single = analysis.encoding === "GSM7" ? 160 : 70;
  const concat = analysis.encoding === "GSM7" ? 153 : 67;
  const maxChars = maxSegments === 1 ? single : single + (maxSegments - 1) * concat;

  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastBreak > maxChars * 0.55) {
    return slice.slice(0, lastBreak + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim() + "...";
}

function customerMentionedNameInThread(thread: MctbConversationTurn[], name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return thread
    .filter((t) => t.role === "customer")
    .some((t) => t.text.toLowerCase().includes(n));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove CRM / guessed sign-off names the customer did not use in the thread. */
export function stripUnverifiedCallerNameFromAgentReply(
  reply: string,
  thread: MctbConversationTurn[],
  crmKnownFirstNames?: Array<string | null | undefined>,
): string {
  const names = new Set<string>();
  for (const n of crmKnownFirstNames || []) {
    if (n?.trim()) names.add(n.trim());
  }
  const trailing = reply.trim().match(/,\s+([A-Z][a-zA-Z'-]{1,24})[.!?]?\s*$/);
  if (trailing?.[1]) names.add(trailing[1]);

  let out = reply.trim();
  for (const name of names) {
    if (customerMentionedNameInThread(thread, name)) continue;
    const esc = escapeRegExp(name);
    out = out.replace(new RegExp(`,\\s+${esc}(?=[.!?]?\\s*$)`, "i"), "");
    out = out.replace(new RegExp(`\\s+${esc}(?=[.!?]?\\s*$)`, "i"), "");
  }
  return out.replace(/,\s*([.!?])\s*$/, "$1").replace(/\s{2,}/g, " ").trim();
}

/** Stop the model copying bad sign-offs from earlier outbound messages in the thread. */
export function sanitizeMctbThreadForAgentPrompt(
  thread: MctbConversationTurn[],
  crmKnownFirstNames?: Array<string | null | undefined>,
): MctbConversationTurn[] {
  const names = (crmKnownFirstNames || []).map((n) => n?.trim()).filter(Boolean) as string[];
  if (!names.length) return thread;

  return thread.map((turn) => {
    if (turn.role !== "business") return turn;
    let text = turn.text;
    for (const name of names) {
      if (customerMentionedNameInThread(thread, name)) continue;
      const esc = escapeRegExp(name);
      text = text.replace(new RegExp(`,\\s+${esc}(?=[.!?,\\s]|$)`, "gi"), "");
    }
    return { ...turn, text: text.replace(/\s{2,}/g, " ").trim() };
  });
}

export function finalizeMctbAgentSmsReply(
  body: string,
  options?: {
    allowedUrl?: string | null;
    thread?: MctbConversationTurn[];
    crmKnownFirstNames?: Array<string | null | undefined>;
  },
): string {
  let text = body;
  if (options?.thread?.length) {
    text = stripUnverifiedCallerNameFromAgentReply(
      text,
      options.thread,
      options.crmKnownFirstNames,
    );
  }
  const stripped = stripUrlsFromMctbAgentSmsReply(text, options?.allowedUrl);
  return truncateMctbAgentSmsToSegmentBudget(stripped);
}
