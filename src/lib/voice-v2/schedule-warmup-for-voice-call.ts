import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { scheduleVoiceV2CallWarmup } from "./call-warmup";

/**
 * Enroll Voice V2 L1/L2 context for an inbound call when the assistant is already
 * running (TeXML-direct / status_callback path — no Call Control answered webhook).
 */
export async function scheduleVoiceV2WarmupForEnsuredVoiceCall(input: {
  callId: string;
  callControlId: string;
  conversationId?: string | null;
}): Promise<{ scheduled: boolean; reason?: string }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: {
      id: true,
      workspaceId: true,
      agentId: true,
      fromE164: true,
      phoneNumberId: true,
    },
  });
  if (!call) return { scheduled: false, reason: "call_not_found" };

  let agentId = call.agentId;
  if (!agentId && call.phoneNumberId) {
    const ai = await resolveInboundAiAgent(call.workspaceId, call.phoneNumberId);
    agentId = ai?.id ?? null;
    if (agentId) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { agentId },
      });
    }
  }
  if (!agentId) return { scheduled: false, reason: "no_inbound_agent" };

  const cfg = await loadVoiceAgentRuntimeConfig(call.workspaceId, agentId).catch(() => null);
  if (!cfg) return { scheduled: false, reason: "agent_config_unavailable" };

  const cc = input.callControlId.trim();
  if (!cc) return { scheduled: false, reason: "missing_call_control_id" };

  scheduleVoiceV2CallWarmup({
    workspaceId: call.workspaceId,
    agentId,
    callId: call.id,
    callControlId: cc,
    fromE164: call.fromE164,
    conversationId: input.conversationId,
    agentConfig: cfg,
    warmupScheduledAt: Date.now(),
  });

  return { scheduled: true };
}
