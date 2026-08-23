import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbPhoneNumberIdForWorkspace } from "@/lib/mctb/platform-production-routing";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";

/** Optional cert override when no workspace DID assigned yet. */
export function getMctbProductionForwardTestE164(): string | null {
  const raw = process.env.MCTB_PRODUCTION_FORWARD_E164?.trim();
  return raw || null;
}

/** Optional default business line for onboarding UI (env: MCTB_TEST_BUSINESS_E164). */
export function getMctbDefaultBusinessLineE164(): string | null {
  const raw = process.env.MCTB_TEST_BUSINESS_E164?.trim();
  return raw || null;
}

/**
 * Production MCTB DID the customer forwards their carrier line to.
 * Always the workspace-assigned number from Setup (runtime.phoneNumberId) —
 * never hardcoded; 571 only appears when that is the number on the account.
 */
export async function getProductionMctbForwardTargetE164(
  workspaceId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const runtime = await loadMissedCallTextConfig(workspaceId);

  if (runtime.phoneNumberId) {
    const phoneId = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId,
      phoneNumberId: runtime.phoneNumberId,
    });
    if (phoneId) {
      const pn = await prisma.phoneNumber.findFirst({
        where: { id: phoneId },
        select: { e164: true, status: true },
      });
      if (pn?.e164 && String(pn.status || "").toLowerCase() !== "released") {
        return pn.e164;
      }
    }
  }

  const phones = await prisma.phoneNumber.findMany({
    where: {
      workspaceId,
      provider: "telnyx",
      status: { not: "Released" },
    },
    orderBy: { purchasedAt: "desc" },
    select: { e164: true, settingsJson: true },
    take: 10,
  });

  for (const phone of phones) {
    if (phone.e164 && isPhoneMctbSipIngress(phone.settingsJson)) {
      return phone.e164;
    }
  }

  return getMctbProductionForwardTestE164();
}
