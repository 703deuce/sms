import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import { evaluateInboundRouting, type RoutingDecision } from "@/lib/voice/routing";
import {
  resolveEffectiveRoutingAction,
  resolveRingTimeoutSeconds,
} from "@/lib/voice/routing-action-resolve";
import { resolveWizardRoutingMode } from "@/lib/solutions/appointment-receptionist/sync-routing";
import type {
  VoiceV3IngressExecutionPlan,
  VoiceV3LiveKitIngressSessionFields,
} from "./ingress-policy-types";

export function buildVoiceV3IngressExecutionPlan(input: {
  routing: RoutingDecision;
  effectiveAction: string;
  ringTeamSecondsFallback: number;
  telephonyAnswerWhen?: string | null;
}): VoiceV3IngressExecutionPlan {
  const actions = input.routing.actions || {};
  const agentId = input.routing.agentId || (actions.agentId as string | undefined);
  const queueId = input.routing.queueId || (actions.queueId as string | undefined);
  const ringSeconds = resolveRingTimeoutSeconds(actions, input.ringTeamSecondsFallback);

  let provisioningNote: string | undefined;
  const answerWhen = input.telephonyAnswerWhen?.trim();
  if (answerWhen === "nobody_answers") {
    provisioningNote =
      "This mode expects unanswered calls to reach Transovo via carrier conditional forwarding (no-answer). A direct LiveKit DID still rings the team in-app, then starts the AI after the configured timeout.";
  }

  if (input.effectiveAction === "human_first") {
    return {
      mode: "after_team_ring",
      effectiveAction: input.effectiveAction,
      routing: input.routing,
      ringSeconds,
      queueId,
      agentId,
      provisioningNote,
    };
  }

  // overflow → ai_agent and ai_answer both start AI immediately on LiveKit ingress.
  return {
    mode: "immediate",
    effectiveAction: input.effectiveAction,
    routing: input.routing,
    ringSeconds,
    queueId,
    agentId,
    provisioningNote,
  };
}

export async function evaluateVoiceV3LiveKitIngress(input: {
  workspaceId: string;
  agentId: string;
  fromE164: string | null;
  toE164: string;
  agentConfig: VoiceV3AgentConfig;
  now?: Date;
}): Promise<VoiceV3IngressExecutionPlan> {
  const routing = await evaluateInboundRouting({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164 || "unknown",
    toE164: input.toE164,
    now: input.now,
  });

  const effectiveAction = await resolveEffectiveRoutingAction(
    input.workspaceId,
    routing.action,
    routing.actions,
    input.now,
  );

  const fallbackRing = Math.max(
    5,
    Math.min(120, Number(input.agentConfig.telephony?.ringTeamSeconds) || 20),
  );

  return buildVoiceV3IngressExecutionPlan({
    routing,
    effectiveAction,
    ringTeamSecondsFallback: fallbackRing,
    telephonyAnswerWhen: input.agentConfig.telephony?.answerWhen,
  });
}

/** Deterministic mapping from wizard telephony alone (no DB) — used in tests and readiness UX. */
export function ingressPlanFromWizardTelephony(input: {
  answerWhen: string;
  ringBehavior: string;
  ringTeamSeconds: number;
  now?: Date;
}): Pick<VoiceV3IngressExecutionPlan, "mode" | "effectiveAction" | "ringSeconds"> {
  const mode = resolveWizardRoutingMode({
    answerWhen: input.answerWhen as never,
    ringBehavior: input.ringBehavior as never,
  });
  const ringSeconds = Math.max(5, Math.min(120, Number(input.ringTeamSeconds) || 20));
  if (mode === "human_first" || mode === "custom_schedule") {
    return { mode: "after_team_ring", effectiveAction: "human_first", ringSeconds };
  }
  if (mode === "ai_after_hours") {
    return { mode: "after_team_ring", effectiveAction: "ai_after_hours", ringSeconds };
  }
  return { mode: "immediate", effectiveAction: "ai_answer", ringSeconds };
}

export async function beginLiveKitTeamRingPhase(input: {
  workspaceId: string;
  voiceCallId: string;
  fromE164: string | null;
  toE164: string;
  plan: VoiceV3IngressExecutionPlan;
}): Promise<{ humanCallId: string }> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const from = input.fromE164?.trim() || "unknown";

  const human = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: input.toE164,
      direction: "inbound",
      status: "ringing",
      notes: `voice_v3_livekit_ingress:${input.voiceCallId}`,
      queueId: input.plan.queueId || null,
    },
  });

  try {
    const { notifyUsersForInboundCall } = await import("@/lib/phone/incoming-notify");
    await notifyUsersForInboundCall({
      workspaceId: input.workspaceId,
      humanCallId: human.id,
      fromE164: from,
      toE164: input.toE164,
      queueId: input.plan.queueId || null,
    });
  } catch (err) {
    console.warn("VOICE_V3_LIVEKIT_TEAM_RING_NOTIFY_FAILED", {
      callId: input.voiceCallId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const call = await prisma.voiceCall.findFirst({
    where: { id: input.voiceCallId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: input.voiceCallId },
    data: {
      metadata: {
        ...meta,
        ingress: {
          transport: "voice_v3_livekit",
          mode: input.plan.mode,
          effectiveAction: input.plan.effectiveAction,
          ringSeconds: input.plan.ringSeconds,
          humanCallId: human.id,
          teamRingStartedAt: new Date().toISOString(),
          routingRuleId: input.plan.routing.ruleId ?? null,
        },
        fallbackAgentId: input.plan.agentId ?? meta.fallbackAgentId,
      } as object,
    },
  });

  return { humanCallId: human.id };
}

export async function assertVoiceV3LiveKitAiStartEligible(input: {
  workspaceId: string;
  voiceCallId: string;
}): Promise<{ proceed: boolean; reason?: string }> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.voiceCallId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!call) return { proceed: false, reason: "call_missing" };

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const ingress = meta.ingress as Record<string, unknown> | undefined;
  const humanCallId = ingress?.humanCallId as string | undefined;
  if (!humanCallId) return { proceed: true };

  const human = await prisma.humanCall.findFirst({
    where: { id: humanCallId, workspaceId: input.workspaceId },
    select: { status: true },
  });
  if (human && ["in_progress", "completed", "answered"].includes(human.status)) {
    return { proceed: false, reason: "human_answered" };
  }
  return { proceed: true };
}

export function ingressFieldsForSession(
  plan: VoiceV3IngressExecutionPlan,
  humanCallId?: string | null,
): VoiceV3LiveKitIngressSessionFields {
  return {
    ingressDelaySeconds: plan.mode === "after_team_ring" ? plan.ringSeconds : 0,
    ingressMode: plan.mode,
    humanCallId: humanCallId ?? null,
    effectiveRoutingAction: plan.effectiveAction,
    routingRuleId: plan.routing.ruleId ?? null,
  };
}
