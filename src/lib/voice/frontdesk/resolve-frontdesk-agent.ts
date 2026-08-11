import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isFrontDeskProfile,
  isFrontDeskRealtimeProfile,
} from "./agent-config";
import { resolveAgentRoutingForCall } from "@/lib/telephony/provisioning";
import type { AgentRoutingResolution } from "@/lib/telephony/provisioning/types";

export type FrontDeskAgentRow = {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string | null;
};

export type InboundFrontDeskRouting = AgentRoutingResolution & {
  metadataAgentId?: string;
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

  type WorkspaceAgent = (typeof agents)[number];

  const frontdesk = agents.filter((agent: WorkspaceAgent) => {
    const config = parseVoiceAgentConfig(agent.draftConfig);
    return isFrontDeskProfile(config.advanced as Record<string, unknown>);
  });
  if (!frontdesk.length) return null;

  const realtime = frontdesk.find((agent: WorkspaceAgent) => {
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

/**
 * LiveKit inbound routing — always resolves to the workspace frontdesk booking agent.
 * Ignores stale Amy dispatch metadata and non-frontdesk phone assignments.
 */
export async function resolveInboundFrontDeskRouting(input: {
  toE164?: string | null;
  workspaceId?: string | null;
  agentId?: string | null;
}): Promise<InboundFrontDeskRouting> {
  const metadataAgentId = input.agentId?.trim() || undefined;
  const routing = await resolveAgentRoutingForCall({
    toE164: input.toE164,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  let workspaceId = routing?.workspaceId || input.workspaceId?.trim();
  if (!workspaceId && input.toE164?.trim()) {
    const prisma = getPrisma();
    const digits = input.toE164.replace(/\D/g, "");
    const phone = await prisma.phoneNumber.findFirst({
      where: {
        OR: [
          { e164: input.toE164.trim() },
          ...(digits ? [{ e164: { endsWith: digits.slice(-10) } }] : []),
        ],
      },
      select: { workspaceId: true },
    });
    workspaceId = phone?.workspaceId;
  }

  if (!workspaceId) {
    throw new Error(
      `No workspace for inbound call ${input.toE164 || "(unknown)"} — assign the DID to frontdesk`,
    );
  }

  const frontdesk = await findFrontDeskAgentForWorkspace(workspaceId);
  if (!frontdesk) {
    throw new Error(
      `No active frontdesk booking agent in ${workspaceId} — run setup:frontdesk-booking-agent`,
    );
  }

  if (routing && frontdesk.id !== routing.agentId) {
    console.log(
      JSON.stringify({
        source: "transovo-agent-routing",
        event: "inbound_frontdesk_only",
        workspaceId,
        previousAgentId: routing.agentId,
        previousAgentName: routing.agentName,
        frontdeskAgentId: frontdesk.id,
        frontdeskAgentName: frontdesk.name,
        toE164: routing.e164 || input.toE164 || null,
        metadataAgentId: metadataAgentId || null,
      }),
    );
  }

  let e164 = routing?.e164 || input.toE164?.trim() || "";
  if (!e164 && frontdesk.phoneNumberId) {
    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: frontdesk.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    e164 = phone?.e164 || "";
  }

  return {
    workspaceId,
    agentId: frontdesk.id,
    agentName: frontdesk.name,
    agentStatus: frontdesk.status,
    phoneNumberId: frontdesk.phoneNumberId || routing?.phoneNumberId || "",
    e164,
    metadataAgentId,
  };
}
