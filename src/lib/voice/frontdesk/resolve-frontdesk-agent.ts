import { getPrisma } from "@/lib/db";
import { resolveAgentRoutingForCall } from "@/lib/telephony/provisioning";
import type { AgentRoutingResolution } from "@/lib/telephony/provisioning/types";
import {
  findPreferredFrontDeskAgentForWorkspace,
  isFrontDeskRuntimeConfig,
  loadFrontDeskRuntimeConfig,
} from "./pick-frontdesk-agent";

export type FrontDeskAgentRow = {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string | null;
};

export type InboundFrontDeskRouting = AgentRoutingResolution & {
  metadataAgentId?: string;
};

/** Active frontdesk agent for a workspace — prefers RE profile and published config. */
export async function findFrontDeskAgentForWorkspace(
  workspaceId: string,
  options?: { preferPhoneNumberId?: string | null },
): Promise<FrontDeskAgentRow | null> {
  const picked = await findPreferredFrontDeskAgentForWorkspace(workspaceId, options);
  if (!picked) return null;
  return {
    id: picked.id,
    name: picked.name,
    status: picked.status,
    phoneNumberId: picked.phoneNumberId,
  };
}

/**
 * LiveKit inbound routing — resolves to the phone-assigned frontdesk agent when valid,
 * otherwise the workspace's preferred RE/generic frontdesk agent.
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
  let phoneNumberId = routing?.phoneNumberId || "";
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
      select: { workspaceId: true, id: true },
    });
    workspaceId = phone?.workspaceId;
    phoneNumberId = phone?.id || phoneNumberId;
  }

  if (!workspaceId) {
    throw new Error(
      `No workspace for inbound call ${input.toE164 || "(unknown)"} — assign the DID to frontdesk`,
    );
  }

  let chosenAgentId: string | undefined;
  let chosenAgentName = routing?.agentName;
  let chosenAgentStatus = routing?.agentStatus;
  let chosenPhoneNumberId = routing?.phoneNumberId || phoneNumberId;

  if (routing?.agentId) {
    const prisma = getPrisma();
    const routedAgent = await prisma.voiceAgent.findFirst({
      where: { id: routing.agentId, workspaceId, status: "ACTIVE" },
      select: { id: true, name: true, status: true, phoneNumberId: true, draftConfig: true },
    });
    if (routedAgent) {
      const runtimeConfig = await loadFrontDeskRuntimeConfig(
        workspaceId,
        routedAgent.id,
        routedAgent.draftConfig,
      );
      if (isFrontDeskRuntimeConfig(runtimeConfig)) {
        chosenAgentId = routedAgent.id;
        chosenAgentName = routedAgent.name;
        chosenAgentStatus = routedAgent.status;
        chosenPhoneNumberId = routedAgent.phoneNumberId || chosenPhoneNumberId;
      }
    }
  }

  if (!chosenAgentId) {
    const frontdesk = await findFrontDeskAgentForWorkspace(workspaceId, {
      preferPhoneNumberId: phoneNumberId || null,
    });
    if (!frontdesk) {
      throw new Error(
        `No active frontdesk booking agent in ${workspaceId} — run setup:frontdesk-booking-agent`,
      );
    }
    chosenAgentId = frontdesk.id;
    chosenAgentName = frontdesk.name;
    chosenAgentStatus = frontdesk.status;
    chosenPhoneNumberId = frontdesk.phoneNumberId || chosenPhoneNumberId;
  } else if (routing?.agentId && chosenAgentId !== routing.agentId) {
    console.log(
      JSON.stringify({
        source: "transovo-agent-routing",
        event: "inbound_frontdesk_fallback",
        workspaceId,
        previousAgentId: routing.agentId,
        previousAgentName: routing.agentName,
        frontdeskAgentId: chosenAgentId,
        frontdeskAgentName: chosenAgentName,
        toE164: routing.e164 || input.toE164 || null,
        metadataAgentId: metadataAgentId || null,
      }),
    );
  }

  let e164 = routing?.e164 || input.toE164?.trim() || "";
  if (!e164 && chosenPhoneNumberId) {
    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: chosenPhoneNumberId, workspaceId },
      select: { e164: true },
    });
    e164 = phone?.e164 || "";
  }

  return {
    workspaceId,
    agentId: chosenAgentId,
    agentName: chosenAgentName || "Front Desk",
    agentStatus: chosenAgentStatus || "ACTIVE",
    phoneNumberId: chosenPhoneNumberId,
    e164,
    metadataAgentId,
  };
}
