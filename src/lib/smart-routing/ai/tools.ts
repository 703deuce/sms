import "server-only";

import { getPrisma } from "@/lib/db";
import { validateDraftConfig } from "../flow-validator";
import type { DraftConfig, FlowValidationResult } from "../types";
import {
  buildAiRoutingFlowContext,
  buildAiRoutingWorkspaceContext,
  loadAiRoutingDestinations,
  resolveDestinationByLabel,
} from "./context-builder";
import {
  formatAnalyticsFacts,
  getRoutingAnalyticsSummary,
} from "./analytics";
import { explainRoutingBehavior, summarizeDraftConfig } from "./config-summary";
import type { AiRoutingAnalyticsSummary, AiRoutingProposalPayload } from "./types";

export type AiRoutingToolContext = {
  workspaceId: string;
  flowId?: string;
  userId?: string;
};

export async function getCurrentRoutingConfig(ctx: AiRoutingToolContext): Promise<{
  flowId: string | null;
  draft: DraftConfig | null;
  summary: string;
}> {
  const flowId = ctx.flowId ?? null;
  if (!flowId) {
    return { flowId: null, draft: null, summary: "No flow selected." };
  }
  const flowCtx = await buildAiRoutingFlowContext(ctx.workspaceId, flowId);
  if (!flowCtx) return { flowId, draft: null, summary: "Flow not found." };
  const destinations = await loadAiRoutingDestinations(ctx.workspaceId);
  return {
    flowId,
    draft: flowCtx.draftConfig,
    summary: summarizeDraftConfig(flowCtx.draftConfig, destinations),
  };
}

export async function getDestinations(ctx: AiRoutingToolContext) {
  return loadAiRoutingDestinations(ctx.workspaceId);
}

export async function getWorkspaceSettingsForAi(ctx: AiRoutingToolContext) {
  return buildAiRoutingWorkspaceContext(ctx.workspaceId);
}

export async function validateRoutingProposal(
  workspaceId: string,
  draft: DraftConfig,
): Promise<FlowValidationResult> {
  const smsNodes = draft.nodes?.some((n) =>
    ["SMS_CONSENT", "SEND_SMS"].includes(n.type),
  );
  let requireSmsApproval = false;
  if (smsNodes) {
    try {
      const { loadComplianceOverview } = await import("@/lib/workspace-data");
      const compliance = await loadComplianceOverview(workspaceId);
      requireSmsApproval = !compliance.ready;
    } catch {
      requireSmsApproval = false;
    }
  }
  return validateDraftConfig(draft, { requireAudio: false, requireSmsApproval });
}

export async function getRoutingAnalytics(
  ctx: AiRoutingToolContext,
  days = 30,
): Promise<AiRoutingAnalyticsSummary> {
  return getRoutingAnalyticsSummary(ctx.workspaceId, days);
}

export async function resolveDestinationNames(
  workspaceId: string,
  names: string[],
): Promise<{
  resolved: Array<{ name: string; destinationId: string; label: string }>;
  missing: string[];
  ambiguous: Array<{ name: string; options: string[] }>;
}> {
  const destinations = await loadAiRoutingDestinations(workspaceId);
  const resolved: Array<{ name: string; destinationId: string; label: string }> = [];
  const missing: string[] = [];
  const ambiguous: Array<{ name: string; options: string[] }> = [];

  for (const name of names) {
    const result = resolveDestinationByLabel(name, destinations);
    if (result.match) {
      resolved.push({
        name,
        destinationId: result.match.id,
        label: result.match.label,
      });
    } else if (result.ambiguous) {
      ambiguous.push({
        name,
        options: result.ambiguous.map((d) => d.label),
      });
    } else {
      missing.push(name);
    }
  }

  return { resolved, missing, ambiguous };
}

export async function explainCurrentRouting(
  ctx: AiRoutingToolContext,
  question: string,
): Promise<string> {
  const { draft } = await getCurrentRoutingConfig(ctx);
  const destinations = await loadAiRoutingDestinations(ctx.workspaceId);
  if (!draft) return "No routing configuration found for this workspace.";
  return explainRoutingBehavior(draft, destinations, question);
}

export async function analyzeRoutingQuestion(
  ctx: AiRoutingToolContext,
  question: string,
  days = 14,
): Promise<{ facts: string; analytics: AiRoutingAnalyticsSummary }> {
  const analytics = await getRoutingAnalytics(ctx, days);
  const facts = formatAnalyticsFacts(analytics);
  const q = question.toLowerCase();
  let extra = "";
  if (q.includes("service")) {
    extra =
      "\nRecommendation (AI): Review Service routing destinations and busy-hour coverage — based on recent call volume.";
  }
  return {
    facts: `${facts}${extra}`,
    analytics,
  };
}

export const AI_ROUTING_READ_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_destinations",
      description: "List workspace routing destinations (people, phones, groups).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_current_routing_config",
      description: "Get current flow draft config summary for the workspace flow.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_workspace_settings",
      description:
        "Get Smart Routing workspace settings: numbers, hours, MCTB, callback, caller ID status.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_routing_analytics",
      description: "Get aggregated call routing analytics for the workspace.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Lookback days (1-90)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "validate_routing_proposal",
      description: "Validate a DraftConfig JSON against the Smart Routing validator.",
      parameters: {
        type: "object",
        properties: {
          routingConfig: { type: "object", description: "Full DraftConfig object" },
        },
        required: ["routingConfig"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "submit_routing_proposal",
      description:
        "Submit final structured routing proposal. Must include routingConfig for create/modify intents.",
      parameters: {
        type: "object",
        properties: {
          intent: { type: "string", enum: ["create", "modify", "analyze", "explain"] },
          summary: { type: "string" },
          proposedChanges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                currentSummary: { type: "string" },
                proposedSummary: { type: "string" },
                changeType: { type: "string" },
              },
            },
          },
          routingConfig: { type: "object" },
          scheduleOverride: { type: "object" },
          temporaryRouting: { type: "object" },
          assumptions: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
          requiresConfirmation: { type: "boolean" },
          clarificationQuestion: { type: "string" },
        },
        required: ["intent", "summary", "requiresConfirmation"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ask_clarification",
      description: "Ask the customer one concise clarifying question before proposing routing.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

export async function executeAiRoutingTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiRoutingToolContext,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "get_destinations":
      return { destinations: await getDestinations(ctx) };
    case "get_current_routing_config":
      return await getCurrentRoutingConfig(ctx);
    case "get_workspace_settings":
      return { settings: await getWorkspaceSettingsForAi(ctx) };
    case "get_routing_analytics":
      return {
        analytics: await getRoutingAnalytics(ctx, Number(args.days) || 30),
      };
    case "validate_routing_proposal": {
      const draft = args.routingConfig as DraftConfig;
      return {
        validation: await validateRoutingProposal(ctx.workspaceId, draft),
      };
    }
    case "get_business_callback_status": {
      const settings = await getWorkspaceSettingsForAi(ctx);
      const prisma = getPrisma();
      const callers = await prisma.smartRoutingAuthorizedCaller.findMany({
        where: { workspaceId: ctx.workspaceId, active: true },
        select: { name: true, outboundEnabled: true },
      });
      return { settings, authorizedCallers: callers };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function parseSubmitPayload(args: Record<string, unknown>): AiRoutingProposalPayload {
  return {
    intent: (args.intent as AiRoutingProposalPayload["intent"]) ?? "modify",
    summary: String(args.summary ?? ""),
    proposedChanges: (args.proposedChanges as AiRoutingProposalPayload["proposedChanges"]) ?? [],
    routingConfig: args.routingConfig as DraftConfig | undefined,
    scheduleOverride: args.scheduleOverride as AiRoutingProposalPayload["scheduleOverride"],
    temporaryRouting: args.temporaryRouting as AiRoutingProposalPayload["temporaryRouting"],
    assumptions: (args.assumptions as string[]) ?? [],
    warnings: (args.warnings as string[]) ?? [],
    requiresConfirmation: Boolean(args.requiresConfirmation ?? true),
    clarificationQuestion: args.clarificationQuestion as string | undefined,
  };
}

export async function checkBobMissingDestination(
  workspaceId: string,
  prompt: string,
): Promise<string | null> {
  const lower = prompt.toLowerCase();
  if (!lower.includes("bob")) return null;
  const destinations = await loadAiRoutingDestinations(workspaceId);
  const bob = resolveDestinationByLabel("bob", destinations);
  if (bob.missing) {
    return "I can add Bob, but I need his phone number first. Bob is not in your destinations yet.";
  }
  return null;
}
