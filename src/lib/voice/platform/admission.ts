/**
 * Runtime admission controls for Telnyx AI call starts.
 * Enforces emergency stop, concurrency caps, and optional spend soft/hard limits.
 */

import { getPrisma } from "@/lib/db";

export type AiAdmissionResult =
  | { ok: true; agent: Awaited<ReturnType<typeof loadAgent>> }
  | { ok: false; reason: string; code: string };

async function loadAgent(workspaceId: string, agentId: string) {
  return getPrisma().voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
}

async function noteFailure(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  category: string;
  code?: string;
  message: string;
  detailsJson?: object;
}) {
  await getPrisma()
    .voiceFailureDiagnostic.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId || null,
        callId: input.callId || null,
        category: input.category,
        code: input.code || null,
        message: input.message.slice(0, 2000),
        detailsJson: (input.detailsJson || {}) as object,
      },
    })
    .catch(() => undefined);
}

/** Count AI legs currently in flight for concurrency gates. */
export async function countActiveAiCalls(
  workspaceId: string,
  direction?: "INBOUND" | "OUTBOUND",
) {
  return getPrisma().voiceCall.count({
    where: {
      workspaceId,
      agentId: { not: null },
      status: { in: ["QUEUED", "INITIATED", "RINGING", "IN_PROGRESS", "ANSWERED"] },
      ...(direction ? { direction } : {}),
    },
  });
}

/**
 * Gate AI assistant start / outbound dial.
 * direction: inbound AI answer vs outbound AI dial.
 */
export async function assertAiCallAdmission(input: {
  workspaceId: string;
  agentId: string;
  direction: "INBOUND" | "OUTBOUND";
  callId?: string | null;
}): Promise<AiAdmissionResult> {
  const prisma = getPrisma();
  const agent = await loadAgent(input.workspaceId, input.agentId);
  if (!agent) {
    return { ok: false, reason: "Agent not found", code: "agent_missing" };
  }
  if (agent.emergencyDisabled) {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission",
      code: "emergency_disabled",
      message: "AI start blocked: agent emergency-disabled",
    });
    return { ok: false, reason: "Agent emergency-disabled", code: "emergency_disabled" };
  }

  const alloc =
    (await prisma.voiceConcurrencyAllocation.findUnique({
      where: { workspaceId: input.workspaceId },
    })) || {
      maxInboundAi: 5,
      maxOutboundAi: 0,
      hardSpendLimitCents: null as number | null,
      softAlertPct: 80,
    };

  const active = await countActiveAiCalls(input.workspaceId, input.direction);
  // Inbound always capped. Outbound: maxOutboundAi<=0 means "no platform cap"
  // (campaign pacing / Missions stay separately gated by outboundAiEnabled).
  const cap =
    input.direction === "INBOUND" ? alloc.maxInboundAi : alloc.maxOutboundAi;
  if (cap > 0 && active >= cap) {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission",
      code: "concurrency_cap",
      message: `AI start blocked: ${input.direction} active=${active} cap=${cap}`,
      detailsJson: { active, cap, direction: input.direction },
    });
    return {
      ok: false,
      reason: `${input.direction} AI concurrency cap reached (${active}/${cap})`,
      code: "concurrency_cap",
    };
  }

  if (alloc.hardSpendLimitCents != null && alloc.hardSpendLimitCents >= 0) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const usage = await prisma.voiceUsageRecord.aggregate({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: monthStart },
      },
      _sum: { billedCostCents: true },
    });
    const spent = usage._sum.billedCostCents || 0;
    if (spent >= alloc.hardSpendLimitCents) {
      await noteFailure({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        callId: input.callId || null,
        category: "admission",
        code: "spend_cap",
        message: `AI start blocked: spend ${spent} >= hard limit ${alloc.hardSpendLimitCents}`,
      });
      return {
        ok: false,
        reason: "Hard monthly AI spend limit reached",
        code: "spend_cap",
      };
    }
  }

  return { ok: true, agent };
}

/** Softphone / conference: only start AI on extra legs when multiPartyEnabled. */
export async function canStartMultiPartyAi(workspaceId: string, agentId: string) {
  const agent = await loadAgent(workspaceId, agentId);
  return Boolean(agent && !agent.emergencyDisabled && agent.multiPartyEnabled);
}
