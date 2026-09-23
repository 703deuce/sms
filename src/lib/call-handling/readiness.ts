import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveAiReceptionistForCallHandling } from "./resolve-ai-receptionist";
import { resolveCanonicalVoiceIngressPhoneNumberId } from "./resolve-canonical-voice-ingress";
import { readCallHandlingBlock } from "./phone-settings";

export async function assessMctbCallHandlingReadiness(input: {
  workspaceId: string;
  voiceIngressPhoneNumberId: string;
}): Promise<{ ready: boolean; message: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.voiceIngressPhoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, providerNumberId: true },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    return { ready: false, message: "Voice ingress number is not ready for MCTB routing." };
  }

  const runtime = await loadMissedCallTextConfig(input.workspaceId);
  if (!runtime.phoneNumberId) {
    return {
      ready: false,
      message: "Finish Missed Call Text Back setup before switching call handling.",
    };
  }
  if (runtime.phoneNumberId !== phone.id) {
    return {
      ready: false,
      message: "MCTB voice ingress is not configured on this forwarding number.",
    };
  }

  return { ready: true, message: null };
}

export async function assessAiReceptionistCallHandlingReadiness(input: {
  workspaceId: string;
  preferredAgentId?: string | null;
}): Promise<{
  ready: boolean;
  message: string | null;
  agentId: string | null;
  aiVoicePhoneNumberId: string | null;
}> {
  const ingressId = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: input.workspaceId,
  });
  if (!ingressId) {
    return {
      ready: false,
      message: "Voice ingress is not configured for this workspace.",
      agentId: null,
      aiVoicePhoneNumberId: null,
    };
  }

  const prisma = getPrisma();
  const ingress = await prisma.phoneNumber.findFirst({
    where: { id: ingressId, workspaceId: input.workspaceId },
    select: { e164: true, providerNumberId: true },
  });
  if (!ingress?.e164 || !ingress.providerNumberId) {
    return {
      ready: false,
      message: "Voice ingress number is not ready for AI Receptionist routing.",
      agentId: null,
      aiVoicePhoneNumberId: null,
    };
  }

  const resolved = await resolveAiReceptionistForCallHandling({
    workspaceId: input.workspaceId,
    preferredAgentId: input.preferredAgentId,
  });

  if (!resolved) {
    return {
      ready: false,
      message: "AI Receptionist isn't ready yet. Finish setup before switching call handling.",
      agentId: null,
      aiVoicePhoneNumberId: null,
    };
  }

  if (!resolved.published || resolved.status !== "ACTIVE") {
    return {
      ready: false,
      message:
        "AI Receptionist isn't ready yet. Publish your receptionist before switching call handling.",
      agentId: resolved.agentId,
      aiVoicePhoneNumberId: resolved.aiVoicePhoneNumberId,
    };
  }

  return {
    ready: true,
    message: null,
    agentId: resolved.agentId,
    aiVoicePhoneNumberId: resolved.aiVoicePhoneNumberId,
  };
}

export async function readParkedAiAgentIdForIngress(
  workspaceId: string,
  voiceIngressPhoneNumberId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: voiceIngressPhoneNumberId, workspaceId },
    select: { settingsJson: true },
  });
  return readCallHandlingBlock(phone?.settingsJson).parkedAiReceptionistAgentId;
}
