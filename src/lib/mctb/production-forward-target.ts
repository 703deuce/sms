import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbPhoneNumberIdForWorkspace } from "@/lib/mctb/platform-production-routing";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { assessWorkspaceDedicatedMctbIngress } from "@/lib/mctb/provisioning/workspace-ingress-validity";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

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
function isForbiddenPlatformIngressCandidate(input: {
  phoneNumberId: string;
  settingsJson: unknown;
  canonicalPlatformSenderId: string | null;
}): boolean {
  if (isPlatformMctbSenderPhoneRecord({ settingsJson: input.settingsJson })) {
    return true;
  }
  if (parseMctbPhoneRole(input.settingsJson) === "platform_mctb_sender") {
    return true;
  }
  if (input.canonicalPlatformSenderId && input.canonicalPlatformSenderId === input.phoneNumberId) {
    return true;
  }
  return false;
}

export async function getProductionMctbForwardTargetE164(
  workspaceId: string,
): Promise<string | null> {
  const assessment = await assessWorkspaceDedicatedMctbIngress(workspaceId);
  if (assessment.valid && assessment.e164) {
    return assessment.e164;
  }

  const prisma = getPrisma();
  const canonical = await resolveCanonicalMctbPlatformSender();
  const canonicalId = canonical?.phoneNumberId ?? null;

  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId) {
    const phoneId = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId,
      phoneNumberId: runtime.phoneNumberId,
    });
    if (phoneId) {
      const pn = await prisma.phoneNumber.findFirst({
        where: { id: phoneId },
        select: { id: true, e164: true, status: true, settingsJson: true },
      });
      if (
        pn?.e164 &&
        String(pn.status || "").toLowerCase() !== "released" &&
        !isForbiddenPlatformIngressCandidate({
          phoneNumberId: pn.id,
          settingsJson: pn.settingsJson,
          canonicalPlatformSenderId: canonicalId,
        })
      ) {
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
    select: { id: true, e164: true, settingsJson: true },
    take: 10,
  });

  for (const phone of phones) {
    if (
      phone.e164 &&
      isPhoneMctbSipIngress(phone.settingsJson) &&
      !isForbiddenPlatformIngressCandidate({
        phoneNumberId: phone.id,
        settingsJson: phone.settingsJson,
        canonicalPlatformSenderId: canonicalId,
      })
    ) {
      return phone.e164;
    }
  }

  return getMctbProductionForwardTestE164();
}
