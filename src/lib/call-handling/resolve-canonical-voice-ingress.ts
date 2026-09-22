import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";

/**
 * Canonical Transovo voice ingress / CFNA target for Call Handling.
 * This is NOT the MCTB SMS sender (`smsPhoneNumberId` may differ).
 */
export async function resolveCanonicalVoiceIngressPhoneNumberId(input: {
  workspaceId: string;
  /** Optional override; must be workspace-owned. */
  voiceIngressPhoneNumberId?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  if (input.voiceIngressPhoneNumberId?.trim()) {
    const owned = await prisma.phoneNumber.findFirst({
      where: { id: input.voiceIngressPhoneNumberId.trim(), workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (owned?.id) return owned.id;
  }

  const runtime = await loadMissedCallTextConfig(input.workspaceId);
  if (runtime.phoneNumberId?.trim()) {
    const owned = await prisma.phoneNumber.findFirst({
      where: { id: runtime.phoneNumberId.trim(), workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (owned?.id) return owned.id;
  }

  const e164 = await getProductionMctbForwardTargetE164(input.workspaceId);
  if (!e164) return null;

  const byE164 = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164 },
    select: { id: true },
  });
  return byE164?.id ?? null;
}

export async function loadCanonicalVoiceIngressPhone(input: {
  workspaceId: string;
  voiceIngressPhoneNumberId?: string | null;
}) {
  const id = await resolveCanonicalVoiceIngressPhoneNumberId(input);
  if (!id) return null;
  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: { id, workspaceId: input.workspaceId },
    select: {
      id: true,
      e164: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
}
