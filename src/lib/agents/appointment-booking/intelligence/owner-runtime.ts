/**
 * Owner Amy bounded decision loop — classify, capability-check, delegate, execute, verify.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { OwnerChatReply } from "@/lib/agents/appointment-booking/owner-chat";
import {
  DEFAULT_OWNER_LOOP_LIMITS,
  type OwnerRuntimeContext,
} from "./types";
import { routeOwnerRequest } from "./request-router";
import { evaluateDelegation } from "./delegation";
import { capabilitiesForIntent, getCapability } from "./capability-catalog";
import { compilePromptModules, OWNER_AMY_DEFAULT_MODULES } from "./prompt-modules";
import { contextSourcesForIntent } from "./context-policy";

export type OwnerLoopState = {
  iteration: number;
  specialistCalls: number;
  route: ReturnType<typeof routeOwnerRequest>;
  contextSources: string[];
  capabilitiesChecked: string[];
  delegatedTo?: string;
  startedAt: number;
};

export function buildOwnerRuntimeContext(input: {
  agent: AppointmentBookingAgentView;
  workspaceId: string;
  userId?: string;
}): OwnerRuntimeContext {
  return {
    agentName: input.agent.identity.displayName,
    businessName: input.agent.businessBrain.businessName,
    workspaceId: input.workspaceId,
    agentId: input.agent.identity.id,
    agentVersionId: input.agent.currentVersionId,
    userPermissionLevel: input.userId ? "owner" : "anonymous",
    localDateTime: new Date().toISOString(),
    timezone: input.agent.profile.timezone,
  };
}

export function buildOwnerAmySystemPrompt(ctx: OwnerRuntimeContext): string {
  return compilePromptModules({
    modules: OWNER_AMY_DEFAULT_MODULES,
    context: {
      agentName: ctx.agentName,
      businessName: ctx.businessName,
      workspaceId: ctx.workspaceId,
      agentVersionId: ctx.agentVersionId || "draft",
      localDateTime: ctx.localDateTime,
      timezone: ctx.timezone,
      userPermissionLevel: ctx.userPermissionLevel,
      agentType: "appointment_booking",
    },
  });
}

export function initOwnerLoop(question: string): OwnerLoopState {
  const route = routeOwnerRequest(question);
  return {
    iteration: 0,
    specialistCalls: 0,
    route,
    contextSources: contextSourcesForIntent("owner_amy", route.intent),
    capabilitiesChecked: capabilitiesForIntent(route.intent).map((c) => c.id),
    delegatedTo: route.delegateTo,
    startedAt: Date.now(),
  };
}

export function assertLoopLimits(state: OwnerLoopState): void {
  const elapsed = Date.now() - state.startedAt;
  if (state.iteration >= DEFAULT_OWNER_LOOP_LIMITS.maxPlanningIterations) {
    throw new Error("Owner Amy planning iteration limit reached.");
  }
  if (state.specialistCalls >= DEFAULT_OWNER_LOOP_LIMITS.maxSpecialistCalls) {
    throw new Error("Owner Amy specialist call limit reached.");
  }
  if (elapsed > DEFAULT_OWNER_LOOP_LIMITS.timeoutMs) {
    throw new Error("Owner Amy request timed out.");
  }
}

export function enrichOwnerReply(
  reply: OwnerChatReply,
  state: OwnerLoopState,
): OwnerChatReply {
  const capability = state.capabilitiesChecked[0]
    ? getCapability(state.capabilitiesChecked[0])
    : undefined;

  return {
    ...reply,
    sources: [
      ...(reply.sources || []),
      `intent:${state.route.intent}`,
      ...(state.delegatedTo ? [`delegated:${state.delegatedTo}`] : []),
    ],
    data: {
      ...(reply.data && typeof reply.data === "object" ? reply.data : {}),
      _intelligence: {
        intent: state.route.intent,
        confidence: state.route.confidence,
        contextSources: state.contextSources,
        capabilitiesChecked: state.capabilitiesChecked,
        delegatedTo: state.delegatedTo,
        capabilityRisk: capability?.riskLevel,
        confirmationRequired: capability?.confirmationRequired,
      },
    },
  };
}

export function preflightOwnerRequest(question: string, agent: AppointmentBookingAgentView): {
  state: OwnerLoopState;
  delegation: ReturnType<typeof evaluateDelegation>;
  blocked?: string;
} {
  const state = initOwnerLoop(question);
  state.iteration += 1;

  const delegation = evaluateDelegation({
    intent: state.route.intent,
    question,
    maxContextBudget: 12_000,
  });

  if (state.route.intent === "restricted_or_unsupported") {
    return {
      state,
      delegation,
      blocked:
        "That request is outside my supported capabilities. I can inspect settings, explain calls, draft booking changes, build workflow drafts, run tests, or request deployment — but I cannot execute arbitrary code or access other workspaces.",
    };
  }

  if (delegation.delegate && delegation.specialist) {
    state.delegatedTo = delegation.specialist;
    state.specialistCalls += 1;
  }

  return { state, delegation };
}
