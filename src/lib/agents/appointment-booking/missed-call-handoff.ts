/**
 * Structured handoff: Appointment Booking Agent → Missed Call Text-Back.
 * Wraps saveMissedCallTextBack; does not rebuild SMS automation.
 */

import { getPrisma } from "@/lib/db";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function attachMissedCallTextBackForAgent(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  activate?: boolean;
  userId?: string;
  firstMessage?: string;
  initialDelaySeconds?: number;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone) throw new Error("Phone number not found");

  const businessName =
    String(asRecord(agent.draftConfig).businessName || agent.displayName || agent.name || "")
      .trim() || "our office";

  const saved = await saveMissedCallTextBack(input.workspaceId, {
    name: `${agent.displayName || agent.name} — Missed Call Text-Back`,
    phoneNumberId: phone.id,
    activate: Boolean(input.activate),
    firstMessage:
      input.firstMessage ||
      `Hi, this is ${businessName}. Sorry we missed your call — reply here and we'll get you scheduled.`,
    initialDelaySeconds:
      input.initialDelaySeconds != null ? input.initialDelaySeconds : 20,
    initialDelayMinutes: 0,
  });

  // Record structured handoff on the agent operating state.
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = asRecord(config.advanced);
  const operating = asRecord(advanced.agentOperating);
  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: {
      ...config,
      advanced: {
        ...advanced,
        agentOperating: {
          ...operating,
          missedCallTextBack: {
            setupId: saved.setupId,
            flowId: saved.flowId,
            phoneNumberId: phone.id,
            attachedAt: new Date().toISOString(),
            attachedBy: input.userId || null,
            activate: Boolean(input.activate),
          },
        },
      },
    },
  });

  if (input.userId) {
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        event: "agent.missed_call_text_back_attached",
        detail: `agent=${input.agentId} setup=${saved.setupId} flow=${saved.flowId}`,
      },
    });
  }

  return {
    ok: true,
    setupId: saved.setupId,
    flowId: saved.flowId,
    phoneNumberId: phone.id,
    phoneE164: phone.e164,
    href: `/automations/${saved.flowId}/edit`,
    solutionHref: `/solutions/missed-call-text-back?setupId=${saved.setupId}`,
  };
}

export async function getMissedCallHandoff(agentDraftConfig: unknown) {
  const config = parseVoiceAgentConfig(agentDraftConfig || {});
  const operating = asRecord(asRecord(config.advanced).agentOperating);
  return operating.missedCallTextBack || null;
}
