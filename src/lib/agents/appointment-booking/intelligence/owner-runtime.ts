/**
 * Owner Amy bounded decision loop — classify, capability-check, delegate, execute, verify.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { OwnerChatReply } from "@/lib/agents/appointment-booking/owner-chat";
import {
  DEFAULT_OWNER_LOOP_LIMITS,
  type OwnerAmyRuntimeDebug,
  type OwnerRuntimeContext,
} from "./types";
import { routeOwnerRequest } from "./request-router";
import { evaluateDelegation } from "./delegation";
import { capabilitiesForIntent, getCapability } from "./capability-catalog";
import { compilePromptModules, OWNER_AMY_DEFAULT_MODULES } from "./prompt-modules";
import { contextSourcesForIntent } from "./context-policy";
import { getPromptVersionRecord } from "./prompt-versioning";
import {
  getOwnerAmyRuntimeMode,
  hasOwnerAmyLlmConfigured,
  ownerAmyModelLabel,
  resolveLlmProvidersForRuntime,
} from "./owner-model-config";
import { listChangeProposals } from "@/lib/agents/appointment-booking/change-proposals";
import { OWNER_AMY_TOOL_DESCRIPTIONS } from "./tool-descriptions";

export type OwnerLoopState = {
  iteration: number;
  specialistCalls: number;
  specialistsExecuted: string[];
  route: ReturnType<typeof routeOwnerRequest>;
  contextSources: string[];
  capabilitiesChecked: string[];
  lastToolCalls: string[];
  startedAt: number;
};

export function buildOwnerRuntimeContext(input: {
  agent: AppointmentBookingAgentView;
  workspaceId: string;
  userId?: string;
  draftConfig?: unknown;
}): OwnerRuntimeContext {
  const pendingProposalCount = input.draftConfig
    ? listChangeProposals(input.draftConfig).filter((p) => p.status === "pending").length
    : 0;
  return {
    workspaceId: input.workspaceId,
    agentId: input.agent.identity.id,
    agentName: input.agent.identity.displayName,
    businessName: input.agent.businessBrain.businessName,
    currentAgentVersionId: input.agent.currentVersionId,
    currentAgentStatus: input.agent.identity.status,
    currentLocalTime: new Date().toISOString(),
    timezone: input.agent.profile.timezone,
    authenticatedUserId: input.userId || "anonymous",
    authenticatedUserRole: input.userId ? "owner" : "anonymous",
    autonomyMode: input.agent.readiness?.label || "standard",
    pendingProposalCount,
    openAttentionCount: input.agent.readiness?.blockers?.length || 0,
    localDateTime: new Date().toISOString(),
    userPermissionLevel: input.userId ? "owner" : "anonymous",
  };
}

export function buildOwnerAmySystemPrompt(ctx: OwnerRuntimeContext): string {
  return compilePromptModules({
    modules: OWNER_AMY_DEFAULT_MODULES,
    context: ctx,
  });
}

export function buildOwnerAmyRuntimeDebug(input: {
  loopState: OwnerLoopState;
  promptText: string;
  failureReason?: string;
}): OwnerAmyRuntimeDebug {
  const prompt = getPromptVersionRecord("owner_amy");
  const mode = getOwnerAmyRuntimeMode();
  const fallback =
    mode.mode === "llm_agent" && mode.fallback ? mode.fallback : undefined;
  return {
    model: ownerAmyModelLabel(),
    promptVersion: prompt.promptVersion,
    promptHash: prompt.hash,
    enabledTools: OWNER_AMY_TOOL_DESCRIPTIONS.map((t) => t.id),
    lastToolCalls: input.loopState.lastToolCalls,
    providerFallback: fallback,
    contextSize: input.promptText.length,
    loopCount: input.loopState.iteration,
    failureReason: input.failureReason,
    runtimeMode: mode.mode === "llm_agent" ? "llm_agent" : "limited_fallback",
    specialistsExecuted: input.loopState.specialistsExecuted,
  };
}

export function initOwnerLoop(question: string): OwnerLoopState {
  const route = routeOwnerRequest(question);
  return {
    iteration: 0,
    specialistCalls: 0,
    specialistsExecuted: [],
    route,
    contextSources: contextSourcesForIntent("owner_amy", route.intent),
    capabilitiesChecked: capabilitiesForIntent(route.intent).map((c) => c.id),
    lastToolCalls: [],
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
  debug?: OwnerAmyRuntimeDebug,
): OwnerChatReply {
  const capability = state.capabilitiesChecked[0]
    ? getCapability(state.capabilitiesChecked[0])
    : undefined;

  const sources = [...(reply.sources || []), `intent:${state.route.intent}`];

  // Only tag specialists that actually executed — never from preflight routing hints.
  for (const specialist of state.specialistsExecuted) {
    sources.push(`executed:${specialist}`);
  }

  return {
    ...reply,
    sources,
    data: {
      ...(reply.data && typeof reply.data === "object" ? reply.data : {}),
      _intelligence: {
        intent: state.route.intent,
        confidence: state.route.confidence,
        contextSources: state.contextSources,
        capabilitiesChecked: state.capabilitiesChecked,
        specialistsExecuted: state.specialistsExecuted,
        capabilityRisk: capability?.riskLevel,
        confirmationRequired: capability?.confirmationRequired,
      },
      _runtime: debug,
    },
  };
}

export function preflightOwnerRequest(
  question: string,
  agent: AppointmentBookingAgentView,
): {
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

  // Do NOT set delegatedTo or increment specialistCalls here — only on actual execution.
  return { state, delegation };
}

export type OwnerAmyReadiness = {
  ready: boolean;
  mode: "llm_agent" | "limited_fallback";
  checks: Array<{ id: string; ok: boolean; message: string }>;
};

export function checkOwnerAmyReadiness(): OwnerAmyReadiness {
  const mode = getOwnerAmyRuntimeMode();
  const prompt = getPromptVersionRecord("owner_amy");
  const providers = resolveLlmProvidersForRuntime("owner_amy");
  const checks = [
    {
      id: "provider",
      ok: providers.length > 0,
      message:
        providers.length > 0
          ? `Provider configured: ${providers[0].id}/${providers[0].model}`
          : "No LLM provider configured for Owner Amy",
    },
    {
      id: "prompt",
      ok: Boolean(prompt.hash && prompt.promptVersion),
      message: `Prompt ${prompt.promptVersion} (${prompt.hash})`,
    },
    {
      id: "tools",
      ok: OWNER_AMY_TOOL_DESCRIPTIONS.length >= 15,
      message: `${OWNER_AMY_TOOL_DESCRIPTIONS.length} tools registered`,
    },
    {
      id: "conversation_storage",
      ok: true,
      message: "Conversation state stored in agentOperating.ownerAmy",
    },
    {
      id: "audit_logging",
      ok: true,
      message: "Tool calls recorded in conversation state",
    },
  ];
  const ready =
    mode.mode === "llm_agent" && checks.every((c) => c.ok || c.id === "provider");
  return {
    ready: mode.mode === "limited_fallback" ? false : ready,
    mode: mode.mode,
    checks,
  };
}

export function formatOwnerAmyRuntimeIndicator(): string {
  const mode = getOwnerAmyRuntimeMode();
  if (mode.mode === "limited_fallback") {
    return "Owner Amy runtime: Limited fallback — deterministic routing";
  }
  const cfg = ownerAmyModelLabel();
  return `Owner Amy runtime: LLM Agent — ${mode.provider} / ${mode.model}`;
}

export { hasOwnerAmyLlmConfigured };
