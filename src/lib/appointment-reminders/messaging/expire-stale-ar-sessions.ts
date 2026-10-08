import "server-only";

import { getPrisma } from "@/lib/db";
import { AR_REPLY_ELIGIBLE_STATES } from "./ar-platform-sender-pool";

/**
 * At most one reply-eligible AR session per (consumer, platform sender).
 * Expire older eligible sessions when a newer authoritative session wins routing.
 */
export async function expireStaleArReplySessionsExcept(input: {
  keepSessionId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  reason: string;
}): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.arSmsReplySession.updateMany({
    where: {
      consumerE164: input.consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
      NOT: { id: input.keepSessionId },
    },
    data: {
      lifecycleState: "EXPIRED",
      completedAt: new Date(),
      lastUsedAt: new Date(),
      pendingSendReason: input.reason.slice(0, 500),
    },
  });
  return result.count;
}
