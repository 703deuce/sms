import "server-only";

import { getPrisma } from "@/lib/db";
import { shouldStartCallRecording } from "@/lib/voice/inbound";
import {
  isAppointmentReceptionistAgent,
  resolveVoiceV3AgentConfigForAgent,
} from "@/lib/voice-v3/config/from-published-agent";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export async function shouldRecordVoiceV3Call(callId: string): Promise<boolean> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { workspaceId: true, agentId: true, agentVersionId: true, direction: true, metadata: true },
  });
  if (!call?.agentId) return false;

  try {
    const v3 = await resolveVoiceV3AgentConfigForAgent({
      workspaceId: call.workspaceId,
      agentId: call.agentId,
      publishedVersionId: call.agentVersionId,
    });
    const mode = v3.telephony?.callRecording ?? "off";
    const direction =
      call.direction === "OUTBOUND" || call.direction === "outbound" ? "OUTBOUND" : "INBOUND";
    return shouldStartCallRecording(mode, direction);
  } catch {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: call.agentId, workspaceId: call.workspaceId },
      select: { draftConfig: true },
    });
    if (!agent) return false;
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    if (!isAppointmentReceptionistAgent(cfg)) return false;
    const advanced = (cfg.advanced || {}) as Record<string, unknown>;
    const wizard = advanced.appointmentReceptionistWizard as Record<string, unknown> | undefined;
    const mode = wizard?.callRecording ?? "off";
    const direction =
      call.direction === "OUTBOUND" || call.direction === "outbound" ? "OUTBOUND" : "INBOUND";
    return shouldStartCallRecording(mode, direction);
  }
}
