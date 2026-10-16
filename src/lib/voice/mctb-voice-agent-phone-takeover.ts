import "server-only";

import { getPrisma } from "@/lib/db";
import { isMctbTexmlIngressLocked } from "@/lib/mctb/sip-ingress/sync";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";

/**
 * Clear MCTB TeXML lock metadata so Voice Agent wizard can own the DID join table.
 * Telnyx routing is updated on publish via routePhoneToTexmlAssistant / trigger activate.
 */
export async function clearMctbTexmlIngressLockMetadataForVoiceAgent(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ cleared: boolean; e164: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) return { cleared: false, e164: null };
  if (!isMctbTexmlIngressLocked(phone.settingsJson)) {
    return { cleared: false, e164: phone.e164 };
  }

  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object" && !Array.isArray(phone.settingsJson)
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};

  settings.routingOwner = null;
  settings.mctbSipIngress = false;
  if (settings.mctbRole) settings.mctbRole = null;

  const telephony =
    settings.telephony && typeof settings.telephony === "object" && !Array.isArray(settings.telephony)
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};
  delete telephony.routingMode;
  delete telephony.routingOwner;
  settings.telephony = telephony;

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: settings as object },
  });

  if (phone.e164) invalidateMctbTexmlIngressCache(phone.e164);

  return { cleared: true, e164: phone.e164 };
}

/**
 * Clear MCTB / legacy TeXML voice metadata so LiveKit receptionist can own the DID.
 * Does not remove SMS sender, messaging profile, or consent records.
 */
export async function preparePhoneForAiReceptionistVoiceIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ prepared: boolean; e164: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) return { prepared: false, e164: null };

  const cleared = await clearMctbTexmlIngressLockMetadataForVoiceAgent(input);

  const refreshed = await prisma.phoneNumber.findFirst({
    where: { id: phone.id },
    select: { settingsJson: true, e164: true },
  });
  const settings =
    refreshed?.settingsJson &&
    typeof refreshed.settingsJson === "object" &&
    !Array.isArray(refreshed.settingsJson)
      ? { ...(refreshed.settingsJson as Record<string, unknown>) }
      : {};

  settings.mctbSipIngress = false;
  if (settings.mctbRole) settings.mctbRole = null;

  const inbound = settings.mctbInbound;
  if (inbound && typeof inbound === "object" && !Array.isArray(inbound)) {
    const block = { ...(inbound as Record<string, unknown>) };
    if (block.inboundHandlingMode === "VOICE_AGENT") {
      block.inboundHandlingMode = null;
    }
    delete block.voiceTexmlAppId;
    settings.mctbInbound = block;
  }

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: settings as object },
  });

  if (refreshed?.e164) invalidateMctbTexmlIngressCache(refreshed.e164);

  return { prepared: true, e164: refreshed?.e164 ?? phone.e164 ?? cleared.e164 };
}
