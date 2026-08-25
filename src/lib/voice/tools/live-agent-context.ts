import { getPrisma } from "@/lib/db";
import type { LiveAgentExecutionContext } from "@/lib/integrations/framework/execution-source";

export async function resolveLiveAgentExecutionContext(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
}): Promise<LiveAgentExecutionContext> {
  const prisma = getPrisma();
  let agentId = input.agentId || null;
  let agentVersionId: string | null = null;
  const callId = input.callId || null;

  if (callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { agentId: true, agentVersionId: true },
    });
    if (call) {
      agentId = agentId || call.agentId;
      agentVersionId = call.agentVersionId;
    }
  }

  if (!agentId) {
    throw new Error("Live agent execution requires agentId");
  }

  if (!agentVersionId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId: input.workspaceId },
      select: { publishedVersionId: true, currentVersionId: true },
    });
    agentVersionId = agent?.publishedVersionId || agent?.currentVersionId || null;
  }

  return {
    actorType: "agent_runtime",
    agentId,
    agentVersionId,
    callId,
  };
}
