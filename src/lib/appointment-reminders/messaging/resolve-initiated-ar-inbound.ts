import "server-only";

import type { ArSmsReplySession } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { AR_REPLY_ELIGIBLE_STATES } from "./ar-platform-sender-pool";

export type ResolveInitiatedArInboundResult =
  | { status: "matched"; session: ArSmsReplySession }
  | { status: "none" };

/**
 * Match inbound SMS to Appointment Reminders conversations Transovo already started.
 * Key: customer E.164 + platform sender number (indexed on ar_sms_reply_sessions).
 * Only sessions with persisted outbound proof qualify — never body scans or MCTB context.
 */
export async function resolveArInboundFromOutboundInitiatedConversation(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<ResolveInitiatedArInboundResult> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const now = new Date();

  const sessions = await prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
      OR: [{ replyEligibleUntil: null }, { replyEligibleUntil: { gt: now } }],
      AND: {
        OR: [
          { lastOutboundProviderMessageId: { not: null } },
          { lastOutboundMessageId: { not: null } },
        ],
      },
    },
    orderBy: { lastUsedAt: "desc" },
  });

  if (!sessions.length) {
    return { status: "none" };
  }
  if (sessions.length === 1) {
    return { status: "matched", session: sessions[0]! };
  }

  // Multiple eligible sessions on one sender+consumer is invalid operations state.
  // Authoritative winner: most recently used session (same ordering as outbound-initiated proof).
  const winner = sessions[0]!;
  const { expireStaleArReplySessionsExcept } = await import("./expire-stale-ar-sessions");
  const expired = await expireStaleArReplySessionsExcept({
    keepSessionId: winner.id,
    consumerE164: consumer,
    platformPhoneNumberId: input.platformPhoneNumberId,
    reason: "superseded_ambiguous_inbound_resolution",
  });
  if (expired > 0) {
    console.info(
      JSON.stringify({
        event: "ar_inbound_session_deduped",
        keepSessionId: winner.id,
        expiredCount: expired,
        appointmentId: winner.appointmentId,
      }),
    );
  }
  return { status: "matched", session: winner };
}
