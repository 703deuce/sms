/**
 * Normalized forwarding outcomes for Call Activity (provider-agnostic).
 */

import { getPrisma } from "@/lib/db";

export type ForwardCallOutcome =
  | "FORWARDED_ANSWERED"
  | "FORWARDED_NO_ANSWER"
  | "FORWARDED_BUSY"
  | "FORWARDED_FAILED"
  | "SCREENING_TIMEOUT"
  | "SCREENING_REJECTED"
  | "SENT_TO_TRANSOVO_VOICEMAIL"
  | "DESTINATION_VOICEMAIL"
  | "HANG_UP"
  | "VOICEMAIL_LEFT";

const TERMINAL_OUTCOMES: ForwardCallOutcome[] = [
  "FORWARDED_ANSWERED",
  "SENT_TO_TRANSOVO_VOICEMAIL",
  "DESTINATION_VOICEMAIL",
  "HANG_UP",
  "VOICEMAIL_LEFT",
];

export function parseForwardOutcome(notes: string | null | undefined): ForwardCallOutcome | null {
  const match = (notes || "").match(/\[forward_outcome:([A-Z_]+)\]/);
  if (!match?.[1]) return null;
  return match[1] as ForwardCallOutcome;
}

export function hasTerminalForwardOutcome(notes: string | null | undefined): boolean {
  const outcome = parseForwardOutcome(notes);
  return outcome !== null && TERMINAL_OUTCOMES.includes(outcome);
}

export async function tagForwardOutcome(
  humanCallId: string,
  outcome: ForwardCallOutcome,
  extraNote?: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findUnique({ where: { id: humanCallId } });
  if (!call) return false;
  if (hasTerminalForwardOutcome(call.notes)) return false;

  const tag = `[forward_outcome:${outcome}]`;
  const notes = `${call.notes || ""}\n${tag}${extraNote ? `\n${extraNote}` : ""}`.trim();

  const status =
    outcome === "FORWARDED_ANSWERED"
      ? "in_progress"
      : outcome === "SENT_TO_TRANSOVO_VOICEMAIL" || outcome === "VOICEMAIL_LEFT"
        ? "voicemail"
        : outcome === "HANG_UP"
          ? "no-answer"
          : call.status;

  await prisma.humanCall.update({
    where: { id: humanCallId },
    data: {
      notes,
      disposition: outcome.toLowerCase().replace(/_/g, "-"),
      status,
      ...(outcome === "FORWARDED_ANSWERED" ? { answeredAt: new Date() } : {}),
    },
  });
  return true;
}
