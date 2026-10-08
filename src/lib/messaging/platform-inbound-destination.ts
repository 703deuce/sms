import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  isPlatformMctbSenderPhoneRecord,
  isPreservedTwilioPlatformMctbSenderRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

export type PlatformInboundDestination = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  provider: string;
};

function isSharedPlatformSenderRow(settingsJson: unknown): boolean {
  return (
    isPlatformMctbSenderPhoneRecord({ settingsJson }) ||
    isPreservedTwilioPlatformMctbSenderRecord({ settingsJson })
  );
}

/** Resolve inbound SMS destination when `to` is a Transovo shared platform sender (Telnyx and/or Twilio). */
export async function resolvePlatformInboundDestination(
  toRaw: string,
): Promise<PlatformInboundDestination | null> {
  let toE164 = toRaw.trim();
  try {
    toE164 = normalizeE164(toRaw);
  } catch {
    // keep raw for lookup fallback
  }

  const prisma = getPrisma();
  const direct = await prisma.phoneNumber.findFirst({
    where: { status: "Active", e164: toE164 },
    select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
  });
  if (direct?.e164 && isSharedPlatformSenderRow(direct.settingsJson)) {
    return {
      phoneNumberId: direct.id,
      e164: direct.e164,
      workspaceId: direct.workspaceId,
      provider: String(direct.provider || "").toLowerCase() || "telnyx",
    };
  }

  const canonical = await resolveCanonicalMctbPlatformSender();
  if (canonical) {
    try {
      if (normalizeE164(canonical.e164) === normalizeE164(toE164)) {
        return {
          phoneNumberId: canonical.phoneNumberId,
          e164: canonical.e164,
          workspaceId: canonical.workspaceId,
          provider: canonical.provider,
        };
      }
    } catch {
      if (canonical.e164 === toE164) {
        return {
          phoneNumberId: canonical.phoneNumberId,
          e164: canonical.e164,
          workspaceId: canonical.workspaceId,
          provider: canonical.provider,
        };
      }
    }
  }

  return null;
}

export async function isTransovoSharedPlatformInboundNumber(toRaw: string): Promise<boolean> {
  return Boolean(await resolvePlatformInboundDestination(toRaw));
}
