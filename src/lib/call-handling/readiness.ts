import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/from-published-agent";
import { getPhoneNumberAiOwner } from "@/lib/voice/agent-phone";
import { readCallHandlingBlock } from "./phone-settings";

export async function assessMctbCallHandlingReadiness(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ ready: boolean; message: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, providerNumberId: true },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    return { ready: false, message: "Phone number is not ready for MCTB routing." };
  }

  const runtime = await loadMissedCallTextConfig(input.workspaceId);
  const configPhoneId = runtime.phoneNumberId || runtime.smsPhoneNumberId;
  if (!configPhoneId) {
    return {
      ready: false,
      message: "Finish Missed Call Text Back setup before switching call handling.",
    };
  }
  if (configPhoneId !== phone.id) {
    return {
      ready: false,
      message: "MCTB is not configured on this forwarding number yet.",
    };
  }

  return { ready: true, message: null };
}

export async function assessAiReceptionistCallHandlingReadiness(input: {
  workspaceId: string;
  phoneNumberId: string;
  preferredAgentId?: string | null;
}): Promise<{ ready: boolean; message: string | null; agentId: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, settingsJson: true, e164: true, providerNumberId: true },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    return {
      ready: false,
      message: "Phone number is not ready for AI Receptionist routing.",
      agentId: null,
    };
  }

  const parked = readCallHandlingBlock(phone.settingsJson).parkedAiReceptionistAgentId;
  let agentId = input.preferredAgentId?.trim() || parked || null;

  if (!agentId) {
    const owner = await getPhoneNumberAiOwner(input.workspaceId, phone.id);
    agentId = owner?.id ?? null;
  }

  if (!agentId) {
    return {
      ready: false,
      message: "AI Receptionist isn't ready yet. Finish setup before switching call handling.",
      agentId: null,
    };
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      publishedVersionId: true,
      phoneNumberId: true,
      draftConfig: true,
    },
  });
  if (!agent) {
    return {
      ready: false,
      message: "AI Receptionist isn't ready yet. Finish setup before switching call handling.",
      agentId: null,
    };
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (!isAppointmentReceptionistAgent(config)) {
    return {
      ready: false,
      message: "This AI agent is not configured as an appointment receptionist.",
      agentId: agent.id,
    };
  }

  if (agent.status !== "ACTIVE" || !agent.publishedVersionId) {
    return {
      ready: false,
      message: "AI Receptionist isn't ready yet. Publish your receptionist before switching call handling.",
      agentId: agent.id,
    };
  }

  return { ready: true, message: null, agentId: agent.id };
}
