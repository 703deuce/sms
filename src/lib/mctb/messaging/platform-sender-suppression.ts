import "server-only";

import { getPrisma } from "@/lib/db";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

/** Shared with inbound outbound pairing — bounded reply eligibility window. */
export { INBOUND_OUTBOUND_PAIRING_WINDOW_MS as MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS } from "@/lib/messaging/inbound-workspace-routing-policy";

export function platformMctbSenderSuppressionKey(
  platformSenderPhoneNumberId: string,
  consumerE164: string,
): string {
  const phone = normalizeMctbCallerE164(consumerE164);
  return `mctb_platform_sender:${platformSenderPhoneNumberId}:p:${phone}`;
}

/**
 * Sender-wide opt-out for the shared Transovo platform TFN (distinct from per-workspace STOP).
 * Stored on the platform-owner workspace with a globally unique suppressionKey.
 */
export async function recordPlatformMctbSenderOptOut(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
  source?: string;
}): Promise<void> {
  const prisma = getPrisma();
  const phone = normalizeMctbCallerE164(input.consumerE164);
  const suppressionKey = platformMctbSenderSuppressionKey(
    input.platformSender.phoneNumberId,
    phone,
  );
  try {
    await prisma.suppression.create({
      data: {
        workspaceId: input.platformSender.workspaceId,
        phone,
        suppressionKey,
        reason: "STOP",
        source: input.source || "mctb_platform_sender_stop",
      },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }
}

export async function isPlatformMctbSenderOptedOut(
  platformSender: CanonicalMctbPlatformSender,
  consumerE164: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(consumerE164);
  const suppressionKey = platformMctbSenderSuppressionKey(
    platformSender.phoneNumberId,
    consumerE164,
  );
  const hit = await prisma.suppression.findFirst({
    where: {
      OR: [{ suppressionKey }, { workspaceId: platformSender.workspaceId, phone: { in: variants } }],
      reason: { in: ["STOP", "OPT_OUT"] },
    },
    select: { id: true },
  });
  return Boolean(hit);
}
