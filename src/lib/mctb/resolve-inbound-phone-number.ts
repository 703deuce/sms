import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveMctbPhoneNumberIdForWorkspace } from "@/lib/mctb/platform-production-routing";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function e164Variants(e164: string): string[] {
  const out = new Set<string>();
  try {
    out.add(normalizeE164(e164));
  } catch {
    // keep raw
  }
  out.add(e164);
  const bare = digitsOnly(e164);
  if (bare) {
    out.add(bare);
    out.add(`+${bare}`);
    if (bare.length === 10) out.add(`+1${bare}`);
  }
  return [...out];
}

/**
 * Resolve the PhoneNumber row for an inbound MCTB/SIP call.
 * Tolerates +E.164 vs bare-digit mismatches that previously left phoneNumberId null.
 */
export async function resolveInboundPhoneNumberId(input: {
  workspaceId: string;
  transovoNumberE164: string;
  businessE164?: string | null;
  isPlatformDemo?: boolean;
}): Promise<string | null> {
  const transovoVariants = e164Variants(input.transovoNumberE164);
  const prisma = getPrisma();

  if (input.isPlatformDemo) {
    const demo = await prisma.phoneNumber.findFirst({
      where: { e164: { in: transovoVariants } },
      select: { id: true },
    });
    if (demo?.id) return demo.id;
  }

  const owned = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId: input.workspaceId,
      e164: { in: transovoVariants },
      status: { not: "released" },
    },
    select: { id: true },
  });
  if (owned?.id) return owned.id;

  return resolveMctbPhoneNumberIdForWorkspace({
    workspaceId: input.workspaceId,
    transovoE164: transovoVariants[0],
  });
}

/** MCTB setup voice + SMS line — same DID in production when A2P-approved. */
export async function resolveMctbConfiguredTriggerPhoneNumberId(
  workspaceId: string,
): Promise<string | null> {
  const { loadMissedCallTextConfig } = await import(
    "@/lib/agents/missed-call-text-back/config"
  );
  const config = await loadMissedCallTextConfig(workspaceId);
  return config.phoneNumberId || config.smsPhoneNumberId || null;
}

export function normalizeBusinessE164ForStorage(
  businessE164: string,
  transovoNumberE164?: string | null,
): string {
  try {
    return normalizeE164(businessE164);
  } catch {
    if (transovoNumberE164) {
      try {
        return normalizeE164(transovoNumberE164);
      } catch {
        return businessE164;
      }
    }
    return businessE164;
  }
}
