import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isFrontDeskProfile,
  isFrontDeskRealtimeProfile,
} from "./agent-config";
import { isInboundFrontDeskDefaultEnabled } from "./frontdesk-boot";

export type FrontDeskAgentRow = {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string | null;
};

/** Active frontdesk booking agent for a workspace (prefers realtime profile). */
export async function findFrontDeskAgentForWorkspace(
  workspaceId: string,
): Promise<FrontDeskAgentRow | null> {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      status: true,
      phoneNumberId: true,
      draftConfig: true,
    },
  });

  const frontdesk = agents.filter((agent) => {
    const config = parseVoiceAgentConfig(agent.draftConfig);
    return isFrontDeskProfile(config.advanced as Record<string, unknown>);
  });
  if (!frontdesk.length) return null;

  const realtime = frontdesk.find((agent) => {
    const config = parseVoiceAgentConfig(agent.draftConfig);
    return isFrontDeskRealtimeProfile(config);
  });
  const chosen = realtime || frontdesk[0]!;
  return {
    id: chosen.id,
    name: chosen.name,
    status: chosen.status,
    phoneNumberId: chosen.phoneNumberId,
  };
}

export { isInboundFrontDeskDefaultEnabled };
