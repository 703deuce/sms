import "server-only";

import { getPrisma } from "@/lib/server/db";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

/** Shared with inbound outbound pairing — bounded reply eligibility window (14 days). */
export const MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function platformMctbSenderSuppressionKey(
  platformSenderPhoneNumberId: string,
  consumerE164: string,
): string {
  const phone = normalizeMctbCallerE164(consumerE164);
  return `mctb_platform_sender:${platformSenderPhoneNumberId}:p:${phone}`;
}

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
  const key = platformMctbSenderSuppressionKey(platformSender.phoneNumberId, consumerE164);
  const hit = await prisma.suppression.findFirst({
    where: { suppressionKey: key },
    select: { id: true },
  });
  if (hit) return true;
  const variants = mctbCallerE164Variants(consumerE164);
  const workspaceHit = await prisma.suppression.findFirst({
    where: {
      workspaceId: platformSender.workspaceId,
      phone: { in: variants },
      reason: "STOP",
    },
    select: { id: true },
  });
  return Boolean(workspaceHit);
}
