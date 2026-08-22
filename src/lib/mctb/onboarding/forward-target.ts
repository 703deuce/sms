/**
 * Onboarding call-forward target — customers forward missed calls to their own
 * Telnyx MCTB SIP DID when provisioned, otherwise the platform 571 demo line.
 */
import { getPrisma } from "@/lib/db";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import {
  MCTB_PLATFORM_DEMO_DISPLAY,
  MCTB_PLATFORM_DEMO_E164,
} from "./constants";
import { formatDemoPhoneDisplay, getPlatformDemoNumberE164 } from "./demo";

/** E.164 fallback when the workspace has no Telnyx MCTB SIP DID yet. */
export function getOnboardingForwardTargetE164(): string {
  return getPlatformDemoNumberE164();
}

/** Workspace-aware forward target — own Telnyx SIP DID first, then platform 571. */
export async function getOnboardingForwardTargetE164ForWorkspace(
  workspaceId: string,
): Promise<string> {
  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: {
      workspaceId,
      provider: "telnyx",
      status: { not: "Released" },
    },
    orderBy: { purchasedAt: "desc" },
    select: { e164: true, settingsJson: true },
    take: 5,
  });

  for (const phone of phones) {
    if (phone.e164 && isPhoneMctbSipIngress(phone.settingsJson)) {
      return phone.e164;
    }
  }

  return getPlatformDemoNumberE164();
}

export function getOnboardingForwardTargetDisplay(): string {
  return MCTB_PLATFORM_DEMO_DISPLAY;
}

export function formatOnboardingForwardTarget(e164: string = MCTB_PLATFORM_DEMO_E164): string {
  return formatDemoPhoneDisplay(e164);
}
