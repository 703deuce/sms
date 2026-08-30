import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import { mergePhoneCapabilitySettings } from "@/lib/numbers/phone-capabilities";

/**
 * Keep `VoiceAgent.phoneNumberId` and the inbound join table
 * `VoiceAgentPhoneNumber` in sync. Inbound AI routing looks up the join table.
 *
 * `exclusive: true` (default on publish) — one DID → one inbound AI owner.
 * Assigning steals the number from any other agent (join rows + stale columns).
 *
 * `exclusive: false` — draft/reserve only: upsert this agent's join without
 * removing another live agent's ownership (so callers keep reaching the ACTIVE
 * agent until Activate).
 */
export async function syncVoiceAgentPhoneAssignment(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string | null | undefined;
  exclusive?: boolean;
}) {
  const prisma = getPrisma();
  const { workspaceId, agentId } = input;
  const exclusive = input.exclusive !== false;

  if (input.phoneNumberId === undefined) return;

  if (!input.phoneNumberId) {
    await prisma.voiceAgentPhoneNumber.deleteMany({
      where: { workspaceId, agentId },
    });
    return;
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId },
  });
  if (!pn) {
    throw new Error("Phone number not found in this workspace");
  }

  const { isMctbTexmlIngressLocked } = await import("@/lib/mctb/sip-ingress/sync");
  if (isMctbTexmlIngressLocked(pn.settingsJson)) {
    throw new Error(
      `${pn.e164} is locked to MCTB TeXML ingress — unassign AI agents before routing MCTB`,
    );
  }

  if (input.phoneNumberId) {
    await prisma.phoneNumber.update({
      where: { id: pn.id },
      data: {
        settingsJson: mergePhoneCapabilitySettings(pn.settingsJson, {
          aiAfterHoursEnabled: true,
          voiceEnabled: true,
        }),
      },
    });
  }

  if (exclusive) {
    // One inbound AI owner per DID: clear other agents on this number.
    await prisma.voiceAgentPhoneNumber.deleteMany({
      where: {
        workspaceId,
        phoneNumberId: pn.id,
        agentId: { not: agentId },
      },
    });

    // Clear stale VoiceAgent.phoneNumberId on other agents that still claim this DID.
    await prisma.voiceAgent.updateMany({
      where: {
        workspaceId,
        phoneNumberId: pn.id,
        id: { not: agentId },
      },
      data: { phoneNumberId: null },
    });
  }

  // Drop this agent's other number assignments (single primary DID for now).
  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: {
      workspaceId,
      agentId,
      phoneNumberId: { not: pn.id },
    },
  });

  await prisma.voiceAgentPhoneNumber.upsert({
    where: {
      agentId_phoneNumberId: { agentId, phoneNumberId: pn.id },
    },
    create: {
      workspaceId,
      agentId,
      phoneNumberId: pn.id,
      inboundEnabled: true,
      outboundEnabled: true,
      isDefault: true,
    },
    update: {
      inboundEnabled: true,
      outboundEnabled: true,
      isDefault: true,
    },
  });
}

/** Resolve the AI agent for an inbound DID (join table, then VoiceAgent.phoneNumberId). */
export async function resolveInboundAiAgent(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();

  const assignments = await prisma.voiceAgentPhoneNumber.findMany({
    where: {
      workspaceId,
      phoneNumberId,
      inboundEnabled: true,
    },
    select: { agentId: true },
  });

  if (assignments.length) {
    const agentIdList = assignments.map((a: { agentId: string }) => a.agentId);
    const agents = await prisma.voiceAgent.findMany({
      where: {
        workspaceId,
        id: { in: agentIdList },
        status: "ACTIVE",
      },
    });
    if (agents.length === 1) return agents[0];
    if (agents.length > 1) {
      type ActiveAgent = (typeof agents)[number];
      const frontdeskAgents = agents.filter((agent: ActiveAgent) => {
        const config = parseVoiceAgentConfig(agent.draftConfig);
        return isFrontDeskProfile(config.advanced as Record<string, unknown>);
      });
      if (frontdeskAgents.length >= 1) {
        const reFrontdesk = frontdeskAgents.filter((agent: ActiveAgent) => {
          const config = parseVoiceAgentConfig(agent.draftConfig);
          return isRealEstateFrontDeskAgent(config.advanced as Record<string, unknown>);
        });
        const pool = reFrontdesk.length ? reFrontdesk : frontdeskAgents;
        return (
          pool.find((a: ActiveAgent) => a.phoneNumberId === phoneNumberId) || pool[0]
        );
      }
      // Prefer the agent whose phoneNumberId still matches (post-switch winner).
      return (
        agents.find((a: ActiveAgent) => a.phoneNumberId === phoneNumberId) || agents[0]
      );
    }
  }

  // Fallback for agents that only set phoneNumberId before join sync existed.
  return prisma.voiceAgent.findFirst({
    where: {
      workspaceId,
      phoneNumberId,
      status: "ACTIVE",
    },
  });
}

/** Current inbound AI owner for a DID — prefer ACTIVE, for switch UI. */
export async function getPhoneNumberAiOwner(
  workspaceId: string,
  phoneNumberId: string,
): Promise<{ id: string; name: string; status: string } | null> {
  const prisma = getPrisma();

  const active = await resolveInboundAiAgent(workspaceId, phoneNumberId);
  if (active) {
    return {
      id: active.id,
      name: active.displayName || active.name,
      status: active.status,
    };
  }

  const assignment = await prisma.voiceAgentPhoneNumber.findFirst({
    where: { workspaceId, phoneNumberId, inboundEnabled: true },
  });
  if (assignment?.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: assignment.agentId, workspaceId },
      select: { id: true, name: true, displayName: true, status: true },
    });
    if (agent) {
      return {
        id: agent.id,
        name: agent.displayName || agent.name,
        status: agent.status,
      };
    }
  }

  const fallback = await prisma.voiceAgent.findFirst({
    where: { workspaceId, phoneNumberId },
    select: { id: true, name: true, displayName: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!fallback) return null;
  return {
    id: fallback.id,
    name: fallback.displayName || fallback.name,
    status: fallback.status,
  };
}
