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
  // Ignore stale legs that never answered / hung — otherwise abandoned
  // INITIATED/RINGING rows permanently block inbound pickup (concurrency_cap).
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000);
  return getPrisma().voiceCall.count({
    where: {
      workspaceId,
      agentId: { not: null },
      status: { in: ["QUEUED", "INITIATED", "RINGING", "IN_PROGRESS", "ANSWERED"] },
      startedAt: { gte: staleBefore },
      ...(direction ? { direction } : {}),
    },
  });
}

/** Mark abandoned open calls completed so admission counters recover. */
export async function sweepStaleOpenVoiceCalls(
  workspaceId: string,
  opts?: { olderThanMs?: number },
) {
  const olderThanMs = opts?.olderThanMs ?? 2 * 60 * 1000;
  const cutoff = new Date(Date.now() - olderThanMs);
  const prisma = getPrisma();
  const stale = await prisma.voiceCall.findMany({
    where: {
      workspaceId,
      status: { in: ["QUEUED", "INITIATED", "RINGING", "IN_PROGRESS", "ANSWERED"] },
      startedAt: { lt: cutoff },
    },
    select: { id: true, telnyxCallControlId: true, status: true },
    take: 200,
  });
  if (!stale.length) return { swept: 0, ids: [] as string[] };

  type StaleCall = {
    id: string;
    telnyxCallControlId: string | null;
    status: string;
  };
  const staleRows = stale as StaleCall[];

  // Best-effort hangup on Telnyx so parked legs do not keep ringing.
  try {
    const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
    const { isTelnyxVoiceConfigured } = await import("@/lib/voice/telnyx/assistant-sync");
    if (isTelnyxVoiceConfigured()) {
      await Promise.all(
        staleRows.map(async (c: StaleCall) => {
          if (!c.telnyxCallControlId || c.telnyxCallControlId.startsWith("mock_")) return;
          await telnyxRequest(`/calls/${c.telnyxCallControlId}/actions/hangup`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
        }),
      );
    }
  } catch {
    // ignore telnyx hangup failures — DB sweep still unblocks admission
  }

  await prisma.voiceCall.updateMany({
    where: { id: { in: staleRows.map((c: StaleCall) => c.id) } },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      outcome: "stale_swept",
    },
  });
  return { swept: staleRows.length, ids: staleRows.map((c: StaleCall) => c.id) };
}

/**
 * Gate AI assistant start / outbound dial.
 * direction: inbound AI answer vs outbound AI dial.
 * Also enforces billing plan / trial allowances.
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      billingPlan: true,
      stripeCustomerId: true,
      creditBalanceCents: true,
    },
  });
  const plan = String(workspace?.billingPlan || "growth").toLowerCase();
  if (plan === "suspended" || plan === "canceled") {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission",
      code: "plan_suspended",
      message: `AI start blocked: billing plan=${plan}`,
    });
    return {
      ok: false,
      reason: "Workspace billing is suspended",
      code: "plan_suspended",
    };
  }
  if (
    plan === "trial_pending_card" &&
    !workspace?.stripeCustomerId &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  ) {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission",
      code: "trial_card_required",
      message: "AI start blocked: trial pending payment method",
    });
    return {
      ok: false,
      reason: "Add a payment method to finish trial setup before AI calls",
      code: "trial_card_required",
    };
  }
  if (Number(workspace?.creditBalanceCents ?? 0) < 0) {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission",
      code: "credits_exhausted",
      message: "AI start blocked: negative credit balance",
    });
    return {
      ok: false,
      reason: "Insufficient credit balance for AI calls",
      code: "credits_exhausted",
    };
  }

  const allocRow = await prisma.voiceConcurrencyAllocation.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  // Per-workspace only (not platform-wide). 0 = no concurrency gate.
  // Paid/default workspaces are uncapped — scale is limited by Telnyx/plan spend,
  // not an arbitrary 5-call inbound ceiling. Trial may keep a soft default.
  const trialDefaultInbound = plan.startsWith("trial") ? 10 : 0;
  const alloc = {
    maxInboundAi: allocRow?.maxInboundAi ?? trialDefaultInbound,
    maxOutboundAi: allocRow?.maxOutboundAi ?? 0,
    hardSpendLimitCents: allocRow?.hardSpendLimitCents ?? null,
    softAlertPct: allocRow?.softAlertPct ?? 80,
  };

  const active = await countActiveAiCalls(input.workspaceId, input.direction);
  // Both directions: <=0 means no platform concurrency gate.
  // Campaign pacing / Missions stay separately gated by outboundAiEnabled.
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

  // Soft alert when approaching concurrency cap (does not block).
  const softPct = Number(alloc.softAlertPct ?? 80);
  if (cap > 0 && softPct > 0 && active / cap >= softPct / 100) {
    await noteFailure({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      callId: input.callId || null,
      category: "admission_alert",
      code: "concurrency_soft_alert",
      message: `AI concurrency soft alert: ${input.direction} active=${active} cap=${cap} threshold=${softPct}%`,
      detailsJson: { active, cap, softPct, direction: input.direction },
    });
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

/**
 * Stamp local published version + optional canary cohort on AI start
 * so canary metrics do not collapse to "main".
 */
export async function resolveAiVersionStamp(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
}) {
  const prisma = getPrisma();
  const canary = await prisma.voiceCanaryDeploy.findFirst({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });
  let assistantVersionId = input.publishedVersionId || "main";
  let canaryVersionId: string | null = null;
  if (canary) {
    const rules = (Array.isArray(canary.rulesJson)
      ? canary.rulesJson
      : []) as Array<{ percentage?: number; version_id?: string }>;
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (const rule of rules) {
      cumulative += Number(rule.percentage || 0);
      if (roll < cumulative && rule.version_id) {
        canaryVersionId = String(rule.version_id);
        assistantVersionId = canaryVersionId;
        break;
      }
    }
  }
  return {
    agentVersionId: input.publishedVersionId || null,
    assistantVersionId,
    canaryVersionId,
    canaryActive: Boolean(canary),
  };
}
