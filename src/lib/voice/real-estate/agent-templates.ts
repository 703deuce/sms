import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
} from "@/lib/voice/frontdesk/agent-config";
import {
  isOutboundLeadQualificationProfile,
  isOutboundLeadQualificationStackProfile,
} from "@/lib/voice/outbound/agent-config";
import { isRealEstateFrontDeskAgent } from "./config";

/** Canonical inbound template — existing front desk booking agent (Realtime). */
export const FRONT_DESK_TEMPLATE_AGENT_NAMES = [
  "Front Desk Booking (Realtime)",
  "Front Desk Booking (Demo)",
  "Front Desk Booking",
  "Real Estate Front Desk",
] as const;

/** Canonical outbound template — existing outbound lead qualification agent. */
export const OUTBOUND_TEMPLATE_AGENT_NAMES = [
  "Outbound Lead Qualification (Demo)",
  "Outbound Lead Qualification",
  "Outbound Lead Qualification (Realtime Test)",
] as const;

export const REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME = "Real Estate Front Desk";
export const REAL_ESTATE_DEPLOYED_OUTBOUND_NAME = "Amy Speed-to-Lead";

export type ResolvedVoiceAgentTemplate = {
  agentId: string;
  agentName: string;
  draftConfig: ReturnType<typeof parseVoiceAgentConfig>;
};

export async function resolveFrontDeskTemplateAgent(
  workspaceId: string,
): Promise<ResolvedVoiceAgentTemplate | null> {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, draftConfig: true },
  });

  for (const name of FRONT_DESK_TEMPLATE_AGENT_NAMES) {
    const row = agents.find((a: (typeof agents)[number]) => a.name === name);
    if (row) {
      return {
        agentId: row.id,
        agentName: row.name,
        draftConfig: parseVoiceAgentConfig(row.draftConfig),
      };
    }
  }

  const byProfile = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    const advanced = cfg.advanced as Record<string, unknown> | undefined;
    return isFrontDeskProfile(advanced) && !isRealEstateFrontDeskAgent(advanced);
  });
  if (byProfile) {
    return {
      agentId: byProfile.id,
      agentName: byProfile.name,
      draftConfig: parseVoiceAgentConfig(byProfile.draftConfig),
    };
  }

  const existingRe = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return isRealEstateFrontDeskAgent(cfg.advanced as Record<string, unknown>);
  });
  if (existingRe) {
    return {
      agentId: existingRe.id,
      agentName: existingRe.name,
      draftConfig: parseVoiceAgentConfig(existingRe.draftConfig),
    };
  }

  return null;
}

export async function resolveOutboundTemplateAgent(
  workspaceId: string,
): Promise<ResolvedVoiceAgentTemplate | null> {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, draftConfig: true },
  });

  for (const name of OUTBOUND_TEMPLATE_AGENT_NAMES) {
    const row = agents.find((a: (typeof agents)[number]) => a.name === name);
    if (row) {
      return {
        agentId: row.id,
        agentName: row.name,
        draftConfig: parseVoiceAgentConfig(row.draftConfig),
      };
    }
  }

  const byProfile = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return isOutboundLeadQualificationStackProfile(cfg);
  });
  if (byProfile) {
    return {
      agentId: byProfile.id,
      agentName: byProfile.name,
      draftConfig: parseVoiceAgentConfig(byProfile.draftConfig),
    };
  }

  const realtimeClone = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return isOutboundLeadQualificationProfile(cfg);
  });
  if (realtimeClone) {
    return {
      agentId: realtimeClone.id,
      agentName: realtimeClone.name,
      draftConfig: parseVoiceAgentConfig(realtimeClone.draftConfig),
    };
  }

  return null;
}

export function frontDeskTemplateProfile(): string {
  return FRONTDESK_REALTIME_PROFILE;
}
