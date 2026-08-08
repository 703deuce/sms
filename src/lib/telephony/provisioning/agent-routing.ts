import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import type { AgentRoutingResolution } from "../types";

/**
 * Authoritative Transovo lookup: called number → workspace → active agent.
 * LiveKit dispatch stays generic; tenant/agent resolution happens here.
 */
export async function resolveAgentByCalledNumber(
  toE164: string,
): Promise<AgentRoutingResolution | null> {
  const e164 = normalizeE164(toE164);
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: { id: true, workspaceId: true, e164: true, status: true },
  });
  if (!phone) return null;

  const agent = await resolveInboundAiAgent(phone.workspaceId, phone.id);
  if (!agent) return null;

  return {
    workspaceId: phone.workspaceId,
    agentId: agent.id,
    phoneNumberId: phone.id,
    e164: phone.e164,
    agentStatus: agent.status,
    agentName: agent.name,
  };
}

export async function resolveAgentRoutingForCall(input: {
  toE164?: string | null;
  workspaceId?: string | null;
  agentId?: string | null;
}): Promise<AgentRoutingResolution | null> {
  if (input.workspaceId && input.agentId) {
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        status: true,
        phoneNumberId: true,
      },
    });
    if (!agent) return null;
    let e164 = input.toE164 || "";
    if (!e164 && agent.phoneNumberId) {
      const pn = await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId },
        select: { e164: true },
      });
      e164 = pn?.e164 || "";
    }
    return {
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId || "",
      e164,
      agentStatus: agent.status,
      agentName: agent.name,
    };
  }

  if (input.toE164) {
    return resolveAgentByCalledNumber(input.toE164);
  }

  return null;
}
