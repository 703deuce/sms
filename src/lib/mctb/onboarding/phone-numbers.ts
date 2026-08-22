import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { MCTB_PLATFORM_DEMO_E164 } from "./constants";
import { getPlatformDemoNumberE164 } from "./demo";

/** Platform demo DID — direct-call demo ingress only (env: MCTB_PLATFORM_DEMO_E164). */
export function getMctbDemoIngressE164(): string {
  return getPlatformDemoNumberE164();
}

/** Optional cert override for production forward target when no workspace DID assigned yet. */
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
 * Production MCTB DID customers forward to — never the platform demo line.
 * Resolution: workspace Telnyx SIP DID → runtime config phone → env test override.
 */
export async function getProductionMctbForwardTargetE164(
  workspaceId: string,
): Promise<string | null> {
  const prisma = getPrisma();
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

  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId) {
    const configured = await prisma.phoneNumber.findFirst({
      where: { id: runtime.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    if (configured?.e164) {
      return configured.e164;
    }
  }

  return getMctbProductionForwardTestE164();
}

export function isPlatformDemoIngressE164(e164: string): boolean {
  try {
    const normalized = e164.replace(/\D/g, "");
    const demo = getMctbDemoIngressE164().replace(/\D/g, "");
    return normalized === demo || e164 === MCTB_PLATFORM_DEMO_E164;
  } catch {
    return false;
  }
}
