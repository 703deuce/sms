import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getPlatformDemoNumberE164 } from "@/lib/mctb/onboarding/demo";

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
