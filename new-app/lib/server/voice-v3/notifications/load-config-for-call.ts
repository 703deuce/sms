import "server-only";

import { getPrisma } from "@/lib/server/db";
import { resolveVoiceV3AgentConfigForAgent } from "../config/from-published-agent";
import type { VoiceV3AgentConfig } from "../config/agent-config";

export async function loadVoiceV3NotificationsConfigForCall(
  callId: string,
): Promise<{ workspaceId: string; callId: string; config: VoiceV3AgentConfig } | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { workspaceId: true, agentId: true, agentVersionId: true },
  });
  if (!call?.agentId) return null;
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: call.workspaceId,
    agentId: call.agentId,
    publishedVersionId: call.agentVersionId,
  });
  return { workspaceId: call.workspaceId, callId, config };
}
