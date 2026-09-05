import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveVerifiedBusinessCallerId } from "@/lib/smart-routing/workspace-settings";
import { getCallerIdVerificationStatus } from "@/lib/smart-routing/caller-id-verification";

export type ResolvedOutboundCallerId = {
  fromE164: string;
  phoneNumberId?: string;
  source: "verified_business" | "transovo";
  verifiedBusinessE164?: string | null;
  transovoE164?: string | null;
};

/** Server-side caller ID resolution — never trust client-supplied values. */
export async function resolveAppointmentVoiceCallerId(
  workspaceId: string,
  preferredPhoneNumberId?: string | null,
): Promise<ResolvedOutboundCallerId> {
  const prisma = getPrisma();
  const verified = await resolveVerifiedBusinessCallerId(workspaceId);

  let transovoE164: string | null = null;
  let phoneNumberId: string | undefined;

  if (preferredPhoneNumberId) {
    const preferred = await prisma.phoneNumber.findFirst({
      where: { id: preferredPhoneNumberId, workspaceId, releasedAt: null },
      select: { id: true, e164: true },
    });
    if (preferred?.e164) {
      transovoE164 = normalizeE164(preferred.e164);
      phoneNumberId = preferred.id;
    }
  }

  if (!transovoE164) {
    const fallback = await prisma.phoneNumber.findFirst({
      where: { workspaceId, releasedAt: null, status: { not: "Released" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, e164: true },
    });
    if (fallback?.e164) {
      transovoE164 = normalizeE164(fallback.e164);
      phoneNumberId = fallback.id;
    }
  }

  if (verified) {
    return {
      fromE164: verified,
      phoneNumberId,
      source: "verified_business",
      verifiedBusinessE164: verified,
      transovoE164,
    };
  }

  if (!transovoE164) {
    throw new Error(
      "No outbound caller ID available. Add a Transovo phone number or verify your business number.",
    );
  }

  return {
    fromE164: transovoE164,
    phoneNumberId,
    source: "transovo",
    verifiedBusinessE164: null,
    transovoE164,
  };
}

export async function loadCallerIdSettingsForUi(workspaceId: string) {
  const [verification, resolved] = await Promise.all([
    getCallerIdVerificationStatus(workspaceId),
    resolveAppointmentVoiceCallerId(workspaceId).catch(() => null),
  ]);

  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId, releasedAt: null, status: { not: "Released" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, e164: true, friendlyName: true },
    take: 10,
  });

  return {
    verification,
    outboundCallerId: resolved?.fromE164 ?? null,
    outboundSource: resolved?.source ?? null,
    transovoNumbers: numbers,
    provisionedPhoneNumberId: resolved?.phoneNumberId ?? numbers[0]?.id ?? null,
  };
}
