import { getPrisma } from "@/lib/server/db";
import { RECEPTIONIST_AGENT_TYPE } from "@/lib/server/receptionist/constants";

export type InboundAgentRouting = {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  paused: boolean;
};

export function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function resolveReceptionistByCalledNumber(
  dialedE164: string,
): Promise<InboundAgentRouting | null> {
  const e164 = normalizeE164(dialedE164.trim());
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164, status: "Active" },
    select: { id: true, workspaceId: true },
  });
  if (!phone) return null;

  const assignment = await prisma.voiceAgentPhoneNumber.findFirst({
    where: {
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      inboundEnabled: true,
      agent: {
        agentType: RECEPTIONIST_AGENT_TYPE,
        archivedAt: null,
        status: { in: ["ACTIVE", "TESTING"] },
      },
    },
    include: { agent: true },
    orderBy: { isDefault: "desc" },
  });

  if (!assignment) {
    const fallbackAgent = await prisma.voiceAgent.findFirst({
      where: {
        workspaceId: phone.workspaceId,
        agentType: RECEPTIONIST_AGENT_TYPE,
        archivedAt: null,
        status: { in: ["ACTIVE", "TESTING"] },
        phoneNumberId: phone.id,
      },
    });
    if (!fallbackAgent) return null;
    return {
      workspaceId: phone.workspaceId,
      agentId: fallbackAgent.id,
      phoneNumberId: phone.id,
      paused: fallbackAgent.emergencyDisabled || fallbackAgent.status === "PAUSED",
    };
  }

  return {
    workspaceId: phone.workspaceId,
    agentId: assignment.agentId,
    phoneNumberId: phone.id,
    paused: assignment.agent.emergencyDisabled || assignment.agent.status === "PAUSED",
  };
}
