import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { hasGenericReceptionistProfile } from "@/lib/voice/receptionist/runtime";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";

export type PhoneReassignmentGuardResult = {
  skip: boolean;
  reason?: string;
  ownerAgentId?: string;
  ownerAgentName?: string;
};

function isPublishedWizardReceptionist(
  advanced: Record<string, unknown> | undefined,
): boolean {
  return hasGenericReceptionistProfile(advanced) && !isRealEstateFrontDeskAgent(advanced);
}

/**
 * Boot-time frontdesk / RE deploy must not steal inbound DIDs owned by a published
 * wizard receptionist (explicit dispatch on that number).
 */
export async function shouldSkipInboundPhoneReassignment(input: {
  workspaceId: string;
  phoneE164: string;
  /** Agent attempting to take the number — excluded from owner scan. */
  requestingAgentId?: string;
}): Promise<PhoneReassignmentGuardResult> {
  const workspaceId = input.workspaceId.trim();
  const phoneE164 = input.phoneE164.trim();
  if (!workspaceId || !phoneE164) return { skip: false };

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: phoneE164 },
    select: { id: true },
  });
  if (!phone) return { skip: false };

  const inboundLinks = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId, phoneNumberId: phone.id, inboundEnabled: true },
    select: { agentId: true },
  });

  for (const link of inboundLinks) {
    if (input.requestingAgentId && link.agentId === input.requestingAgentId) continue;
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: link.agentId, workspaceId },
      select: {
        id: true,
        name: true,
        publishedVersionId: true,
        draftConfig: true,
      },
    });
    if (!agent?.publishedVersionId) continue;
    const advanced = parseVoiceAgentConfig(agent.draftConfig).advanced as
      | Record<string, unknown>
      | undefined;
    if (isPublishedWizardReceptionist(advanced)) {
      return {
        skip: true,
        reason: "published_wizard_receptionist_inbound",
        ownerAgentId: agent.id,
        ownerAgentName: agent.name,
      };
    }
  }

  const primaryOwner = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId,
      phoneNumberId: phone.id,
      publishedVersionId: { not: null },
      ...(input.requestingAgentId ? { id: { not: input.requestingAgentId } } : {}),
    },
    select: { id: true, name: true, draftConfig: true },
  });
  if (primaryOwner) {
    const advanced = parseVoiceAgentConfig(primaryOwner.draftConfig).advanced as
      | Record<string, unknown>
      | undefined;
    if (isPublishedWizardReceptionist(advanced)) {
      return {
        skip: true,
        reason: "published_wizard_receptionist_primary",
        ownerAgentId: primaryOwner.id,
        ownerAgentName: primaryOwner.name,
      };
    }
  }

  return { skip: false };
}
