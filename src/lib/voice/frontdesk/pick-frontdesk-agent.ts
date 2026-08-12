import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  isFrontDeskProfile,
  isFrontDeskRealtimeProfile,
} from "./agent-config";

export type FrontDeskAgentCandidate = {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string | null;
  draftConfig: unknown;
};

export type PickedFrontDeskAgent = {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string | null;
  config: VoiceAgentConfig;
  isRealEstate: boolean;
};

function scoreFrontDeskCandidate(
  agent: FrontDeskAgentCandidate,
  config: VoiceAgentConfig,
  preferPhoneNumberId?: string | null,
): number {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  let score = 0;
  if (isRealEstateFrontDeskAgent(advanced)) score += 100;
  if (isFrontDeskRealtimeProfile(config)) score += 10;
  if (preferPhoneNumberId && agent.phoneNumberId === preferPhoneNumberId) score += 20;
  if (agent.phoneNumberId) score += 5;
  return score;
}

export async function loadFrontDeskRuntimeConfig(
  workspaceId: string,
  agentId: string,
  draftConfig: unknown,
): Promise<VoiceAgentConfig> {
  try {
    return await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  } catch {
    return parseVoiceAgentConfig(draftConfig);
  }
}

export function isFrontDeskRuntimeConfig(config: VoiceAgentConfig): boolean {
  return isFrontDeskProfile(config.advanced as Record<string, unknown>);
}

/** Pick the best inbound frontdesk agent — RE profile wins over generic booking. */
export async function pickPreferredFrontDeskAgent(
  workspaceId: string,
  candidates: FrontDeskAgentCandidate[],
  options?: { preferPhoneNumberId?: string | null },
): Promise<PickedFrontDeskAgent | null> {
  if (!candidates.length) return null;

  const scored: Array<{ agent: FrontDeskAgentCandidate; config: VoiceAgentConfig; score: number }> =
    [];
  for (const agent of candidates) {
    const config = await loadFrontDeskRuntimeConfig(workspaceId, agent.id, agent.draftConfig);
    if (!isFrontDeskRuntimeConfig(config)) continue;
    scored.push({
      agent,
      config,
      score: scoreFrontDeskCandidate(agent, config, options?.preferPhoneNumberId),
    });
  }
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const advanced = best.config.advanced as Record<string, unknown> | undefined;
  return {
    id: best.agent.id,
    name: best.agent.name,
    status: best.agent.status,
    phoneNumberId: best.agent.phoneNumberId,
    config: best.config,
    isRealEstate: isRealEstateFrontDeskAgent(advanced),
  };
}

export async function findPreferredFrontDeskAgentForWorkspace(
  workspaceId: string,
  options?: { preferPhoneNumberId?: string | null },
): Promise<PickedFrontDeskAgent | null> {
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
  return pickPreferredFrontDeskAgent(workspaceId, agents, options);
}
