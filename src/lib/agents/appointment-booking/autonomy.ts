/**
 * Autonomy budget, partial capability pause, and safe auto-repair.
 */

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { expireStaleHolds } from "@/lib/voice/calendar/slot-holds";
import type {
  AgentCapabilityPause,
  AutonomyBudget,
} from "@/lib/agents/appointment-booking/responsibility";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function operating(config: VoiceAgentConfig) {
  return asRecord(asRecord(config.advanced).agentOperating);
}

async function patchOperating(
  workspaceId: string,
  agentId: string,
  patch: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = operating(config);
  await updateVoiceAgentDraft(workspaceId, agentId, {
    draftConfig: {
      ...config,
      advanced: {
        ...asRecord(config.advanced),
        agentOperating: { ...op, ...patch },
      },
    },
  });
}

export async function setAutonomyBudget(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  budget: AutonomyBudget;
  confirm: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true required to change autonomy budget");
  }
  await patchOperating(input.workspaceId, input.agentId, {
    autonomyBudget: input.budget,
  });
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.autonomy_budget_set",
      detail: `agent=${input.agentId} budget=${input.budget}`,
    },
  });
  return { ok: true, budget: input.budget };
}

export async function pauseAgentCapability(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  capability: keyof AgentCapabilityPause;
  reason: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = operating(config);
  const pauses = {
    ...asRecord(op.capabilityPauses),
    [input.capability]: true,
    reason: input.reason,
    pausedAt: new Date().toISOString(),
  } as AgentCapabilityPause;

  let messaging = config.messaging || {};
  if (input.capability === "confirmationSms") {
    messaging = { ...messaging, smsConfirmations: false };
  }

  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: {
      ...config,
      messaging,
      advanced: {
        ...asRecord(config.advanced),
        agentOperating: { ...op, capabilityPauses: pauses },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.capability_paused",
      detail: `agent=${input.agentId} capability=${input.capability} reason=${input.reason}`,
    },
  });
  return { ok: true, pauses };
}

export async function resumeAgentCapability(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  capability: keyof AgentCapabilityPause;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = operating(config);
  const pauses = {
    ...asRecord(op.capabilityPauses),
    [input.capability]: false,
  } as AgentCapabilityPause;

  let messaging = config.messaging || {};
  if (input.capability === "confirmationSms") {
    messaging = { ...messaging, smsConfirmations: true };
  }

  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: {
      ...config,
      messaging,
      advanced: {
        ...asRecord(config.advanced),
        agentOperating: { ...op, capabilityPauses: pauses },
      },
    },
  });
  return { ok: true, pauses };
}

/**
 * Safe auto-repair: expire holds, detect duplicate SMS, pause SMS capability.
 */
export async function runSafeAutoRepair(input: {
  workspaceId: string;
  agentId: string;
}) {
  const expired = await expireStaleHolds(input.workspaceId);
  const prisma = getPrisma();
  const since = new Date(Date.now() - 60 * 60_000);
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      startedAt: { gte: since },
    },
    select: { id: true },
    take: 100,
  });
  const callIds = calls.map((c: { id: string }) => c.id);
  let duplicateSmsPaused = false;
  if (callIds.length) {
    const smsTools = await prisma.voiceToolExecution.findMany({
      where: {
        workspaceId: input.workspaceId,
        callId: { in: callIds },
        createdAt: { gte: since },
      },
      take: 200,
    });
    // Heuristic: many SMS tool executions in an hour → pause confirmation SMS
    if (smsTools.length >= 20) {
      await pauseAgentCapability({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: "system",
        capability: "confirmationSms",
        reason: `Auto-paused: ${smsTools.length} SMS tool executions in the last hour`,
      });
      duplicateSmsPaused = true;
    }
  }

  return {
    ok: true,
    expiredHolds: true,
    expired,
    duplicateSmsPaused,
  };
}
