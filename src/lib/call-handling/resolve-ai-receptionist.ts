import "server-only";

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/from-published-agent";

export type ResolvedAiReceptionist = {
  agentId: string;
  /** May differ from canonical voice ingress. */
  aiVoicePhoneNumberId: string | null;
  status: string;
  published: boolean;
};

/**
 * Resolve the AI Receptionist for Call Handling independently of voice ingress DID.
 */
export async function resolveAiReceptionistForCallHandling(input: {
  workspaceId: string;
  preferredAgentId?: string | null;
}): Promise<ResolvedAiReceptionist | null> {
  const prisma = getPrisma();

  if (input.preferredAgentId?.trim()) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.preferredAgentId.trim(), workspaceId: input.workspaceId },
      select: {
        id: true,
        status: true,
        publishedVersionId: true,
        phoneNumberId: true,
        draftConfig: true,
      },
    });
    if (agent) {
      const config = parseVoiceAgentConfig(agent.draftConfig);
      if (!isAppointmentReceptionistAgent(config)) return null;
      return {
        agentId: agent.id,
        aiVoicePhoneNumberId: agent.phoneNumberId,
        status: agent.status,
        published: Boolean(agent.publishedVersionId),
      };
    }
  }

  const agents = await prisma.voiceAgent.findMany({
    where: {
      workspaceId: input.workspaceId,
      publishedVersionId: { not: null },
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      status: true,
      publishedVersionId: true,
      phoneNumberId: true,
      draftConfig: true,
    },
  });

  for (const agent of agents) {
    const config = parseVoiceAgentConfig(agent.draftConfig);
    if (!isAppointmentReceptionistAgent(config)) continue;
    return {
      agentId: agent.id,
      aiVoicePhoneNumberId: agent.phoneNumberId,
      status: agent.status,
      published: Boolean(agent.publishedVersionId),
    };
  }

  return null;
}
