import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceAgentReadiness } from "./types";

export async function getVoiceAgentReadiness(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId?: string | null;
}): Promise<VoiceAgentReadiness> {
  const reasons: string[] = [];
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      telnyxAssistantId: true,
      publishedVersionId: true,
      phoneNumberId: true,
      status: true,
    },
  });

  if (!agent) {
    return {
      ready: false,
      canAnswer: false,
      reasons: ["voice_agent_not_found"],
      agentId: input.agentId,
      telnyxAssistantId: null,
      published: false,
      phoneLinked: false,
    };
  }

  const published = Boolean(agent.publishedVersionId);
  if (!published) reasons.push("agent_not_published");

  const telnyxAssistantId = agent.telnyxAssistantId?.trim() || null;
  if (!telnyxAssistantId) reasons.push("missing_telnyx_assistant");

  let phoneLinked = Boolean(
    input.phoneNumberId?.trim() || agent.phoneNumberId?.trim(),
  );
  if (!phoneLinked && input.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
      select: { settingsJson: true },
    });
    const inbound =
      pn?.settingsJson &&
      typeof pn.settingsJson === "object" &&
      !Array.isArray(pn.settingsJson)
        ? (pn.settingsJson as Record<string, unknown>).mctbInbound
        : null;
    const block =
      inbound && typeof inbound === "object" && !Array.isArray(inbound)
        ? (inbound as Record<string, unknown>)
        : null;
    if (block?.voiceAgentId === agent.id) {
      phoneLinked = true;
    }
  }
  if (!phoneLinked) reasons.push("phone_not_linked");

  if (agent.status === "disabled") reasons.push("agent_disabled");

  const ready = reasons.length === 0;
  const canAnswer = ready && Boolean(telnyxAssistantId) && published && phoneLinked;

  return {
    ready,
    canAnswer,
    reasons,
    agentId: agent.id,
    telnyxAssistantId,
    published,
    phoneLinked,
  };
}
