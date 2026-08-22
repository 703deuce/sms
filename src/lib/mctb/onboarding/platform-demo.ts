import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getPlatformDemoNumberE164 } from "@/lib/mctb/onboarding/demo";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  isExistingConsentMode,
  isVerifiedCallConsentMode,
} from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_FLOW_NAME } from "@/lib/mctb/consent-prompt/types";

/** Workspace that owns the shared platform demo Telnyx line (voice + A2P SMS routing). */
export async function resolvePlatformDemoOwnerWorkspaceId(): Promise<string | null> {
  const demoE164 = getPlatformDemoNumberE164();
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: demoE164 },
    select: { workspaceId: true },
  });
  return pn?.workspaceId || null;
}

export async function resolvePlatformDemoSmsSender(): Promise<{
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id";
} | null> {
  const demoE164 = getPlatformDemoNumberE164();
  const prisma = getPrisma();

  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: demoE164 },
    select: { id: true, e164: true },
  });

  if (!pn?.e164) return null;
  return { phoneNumberId: pn.id, e164: pn.e164, source: "sms_phone_number_id" };
}

export function normalizeDemoE164(e164: string): string {
  return normalizeE164(e164);
}

/**
 * Point platform 571 at Call Control + smart routing for Pass 3 certification.
 * Overrides LiveKit/TeXML agent routing that would bypass Press-1 consent.
 */
export async function preparePlatformDemoNumberForSmartRouting(): Promise<{
  ownerWorkspaceId: string;
  phoneNumberId: string;
  providerNumberId: string;
}> {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) throw new Error("Platform demo owner workspace not found");

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164, workspaceId: ownerId },
    select: { id: true, providerNumberId: true },
  });
  if (!pn?.providerNumberId) {
    throw new Error(`Platform demo phone ${MCTB_PLATFORM_DEMO_E164} missing Telnyx id`);
  }

  const { assignVoiceConnection } = await import("@/lib/phone/telnyx-dual-provision");
  const { resolveVoiceConnectionId } = await import("@/lib/phone/telnyx-voice-connection");
  const connectionId = await resolveVoiceConnectionId();
  await assignVoiceConnection(pn.providerNumberId, connectionId);

  await prisma.voiceAgent.updateMany({
    where: { workspaceId: ownerId, phoneNumberId: pn.id, status: "ACTIVE" },
    data: { phoneNumberId: null },
  });

  return {
    ownerWorkspaceId: ownerId,
    phoneNumberId: pn.id,
    providerNumberId: pn.providerNumberId,
  };
}

async function findPlatformDemoConsentFlow(ownerWorkspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.findFirst({
    where: {
      workspaceId: ownerWorkspaceId,
      assignedPhoneNumberId: phoneNumberId,
      name: MCTB_CONSENT_FLOW_NAME,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Align platform 571 inbound runtime with the active consent mode.
 * - existing_consent: pause Verified Call Consent IVR so missed calls go direct to SMS
 * - press_1: publish/activate Verified Call Consent on 571
 */
export async function syncPlatformDemoConsentRuntime(mode: MctbConsentMode): Promise<{
  mode: MctbConsentMode;
  action: "paused_verified_consent" | "activated_verified_consent" | "no_flow";
}> {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) throw new Error("Platform demo owner workspace not found");

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164, workspaceId: ownerId },
    select: { id: true },
  });
  if (!pn) throw new Error("Platform demo phone not found");

  if (isExistingConsentMode(mode)) {
    const flow = await findPlatformDemoConsentFlow(ownerId, pn.id);
    if (flow?.status === "active") {
      const { pauseFlow } = await import("@/lib/smart-routing/flow-service");
      await pauseFlow(ownerId, flow.id);
    }
    return { mode, action: "paused_verified_consent" };
  }

  if (isVerifiedCallConsentMode(mode)) {
    const { publishPlatformDemoMctbConsent } = await import(
      "@/lib/mctb/consent-prompt/service"
    );
    await publishPlatformDemoMctbConsent();
    return { mode, action: "activated_verified_consent" };
  }

  const flow = await findPlatformDemoConsentFlow(ownerId, pn.id);
  return { mode, action: flow ? "paused_verified_consent" : "no_flow" };
}
