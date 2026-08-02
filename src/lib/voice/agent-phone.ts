import { getPrisma } from "@/lib/db";

/**
 * Keep `VoiceAgent.phoneNumberId` and the inbound join table
 * `VoiceAgentPhoneNumber` in sync. Inbound AI routing looks up the join table.
 */
export async function syncVoiceAgentPhoneAssignment(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string | null | undefined;
}) {
  const prisma = getPrisma();
  const { workspaceId, agentId } = input;

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

  // One inbound AI owner per DID: clear other agents on this number.
  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: {
      workspaceId,
      phoneNumberId: pn.id,
      agentId: { not: agentId },
    },
  });

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

  const assignment = await prisma.voiceAgentPhoneNumber.findFirst({
    where: {
      workspaceId,
      phoneNumberId,
      inboundEnabled: true,
    },
  });
  if (assignment?.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: assignment.agentId, workspaceId, status: "ACTIVE" },
    });
    if (agent) return agent;
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
