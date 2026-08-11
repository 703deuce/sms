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
  publishedVersionId: string | null;
};

export type InboundFrontDeskRouting = AgentRoutingResolution & {
  metadataAgentId?: string;
  publishedVersionId?: string;
  dispatchSource?: string;
};

async function loadFrontDeskAgentRow(
  workspaceId: string,
  agentId: string,
): Promise<FrontDeskAgentRow | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      status: true,
      phoneNumberId: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (!agent) return null;
  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (!isFrontDeskProfile(config.advanced as Record<string, unknown>)) return null;
  return {
    id: agent.id,
    name: agent.name,
    status: agent.status,
    phoneNumberId: agent.phoneNumberId,
    publishedVersionId: agent.publishedVersionId,
  };
}

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
      publishedVersionId: true,
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
    publishedVersionId: chosen.publishedVersionId,
  };
}

/**
 * LiveKit inbound routing — resolves frontdesk/realtor agents from explicit dispatch metadata
 * when valid, otherwise workspace default frontdesk agent.
 */
export async function resolveInboundFrontDeskRouting(input: {
  toE164?: string | null;
  workspaceId?: string | null;
  agentId?: string | null;
  publishedVersionId?: string | null;
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

  let chosen: FrontDeskAgentRow | null = null;
  let dispatchSource = "workspace_default";

  if (metadataAgentId) {
    const explicit = await loadFrontDeskAgentRow(workspaceId, metadataAgentId);
    if (explicit) {
      chosen = explicit;
      dispatchSource = "explicit_dispatch";
    }
  }

  if (!chosen) {
    chosen = await findFrontDeskAgentForWorkspace(workspaceId);
  }

  if (!chosen) {
    throw new Error(
      `No active frontdesk booking agent in ${workspaceId} — run setup:frontdesk-booking-agent`,
    );
  }

  if (routing && chosen.id !== routing.agentId) {
    console.log(
      JSON.stringify({
        source: "transovo-agent-routing",
        event: "inbound_frontdesk_only",
        workspaceId,
        previousAgentId: routing.agentId,
        previousAgentName: routing.agentName,
        frontdeskAgentId: chosen.id,
        frontdeskAgentName: chosen.name,
        toE164: routing.e164 || input.toE164 || null,
        metadataAgentId: metadataAgentId || null,
        dispatchSource,
      }),
    );
  }

  let e164 = routing?.e164 || input.toE164?.trim() || "";
  if (!e164 && chosen.phoneNumberId) {
    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: chosen.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    e164 = phone?.e164 || "";
  }

  const publishedVersionId =
    input.publishedVersionId?.trim() || chosen.publishedVersionId || undefined;

  return {
    workspaceId,
    agentId: chosen.id,
    agentName: chosen.name,
    agentStatus: chosen.status,
    phoneNumberId: chosen.phoneNumberId || routing?.phoneNumberId || "",
    e164,
    metadataAgentId,
    publishedVersionId,
    dispatchSource,
  };
}
