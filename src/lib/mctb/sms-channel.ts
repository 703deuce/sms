/**
 * MCTB SMS channel rules — brevity and segment economics are production requirements.
 */
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
