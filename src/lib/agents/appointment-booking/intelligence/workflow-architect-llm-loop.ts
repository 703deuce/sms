/**
 * Appointment Workflow Architect — bounded LLM agent loop.
 */

import { createId } from "@/lib/supabase/id";
import { llmChatWithTools, type LlmChatMessage } from "@/lib/ai/llm-tools";
import { resolveLlmProvidersForRuntime, getRuntimeModelConfig } from "./owner-model-config";
import {
  WORKFLOW_ARCHITECT_READ_TOOLS,
  executeWorkflowArchitectTool,
  type WorkflowArchitectToolContext,
} from "./workflow-architect-tools";
import { buildWorkflowArchitectProductionPrompt } from "./workflow-architect-prompt";
import { validateWorkflowDraft, type WorkflowDraft } from "@/lib/agents/appointment-booking/workflow-validator";
import {
  validateWorkflowSemantics,
  semanticErrorsBlockDraft,
} from "./workflow-semantic-validator";
import { generateWorkflowTestPlan } from "./workflow-test-plan";
import { graphDiff } from "./workflow-patch";
import { architectWorkflowFromRequest } from "@/lib/agents/appointment-booking/workflow-architect";
import type { WorkflowArchitectResult } from "./types";
import { WORKFLOW_INVARIANTS } from "./workflow-architect-invariants";
import { stringifyToolResult } from "./tool-result";

export type WorkflowArchitectInvocationRecord = {
  requestId: string;
  runtimeId: "appointment_workflow_architect";
  creationMode: "llm_architect";
  model: string;
  promptVersion: string;
  promptHash?: string;
  nodeCatalogVersion: string;
  toolCalls: string[];
  latencyMs: number;
  draftId?: string;
};

const MAX_ITERATIONS = 6;
const TIMEOUT_MS = 60_000;

export async function runWorkflowArchitectLlmLoop(
  ctx: WorkflowArchitectToolContext,
): Promise<{
  result: WorkflowArchitectResult;
  record: WorkflowArchitectInvocationRecord;
  draft?: WorkflowDraft;
}> {
  const providerChain = resolveLlmProvidersForRuntime("workflow_architect");
  if (!providerChain.length) {
    throw new Error("No LLM provider configured for Workflow Architect");
  }

  const requestId = createId();
  const startedAt = Date.now();
  const toolCalls: string[] = [];
  const cfg = getRuntimeModelConfig("workflow_architect");

  const baseTemplate = architectWorkflowFromRequest({
    agentId: ctx.agentId,
    userRequest: ctx.userRequest,
    phoneNumberId: ctx.phoneNumberId,
    timezone: ctx.timezone,
  });

  const system = buildWorkflowArchitectProductionPrompt({
    businessName: ctx.agent.businessBrain.businessName,
    agentName: ctx.agent.identity.displayName,
    userRequest: ctx.userRequest,
    currentWorkflowSummary: `${baseTemplate.name}: ${baseTemplate.nodes.length} nodes, trigger=${baseTemplate.triggerNodeId}`,
  });

  const messages: LlmChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Create or modify a workflow draft for this request: ${ctx.userRequest}`,
    },
  ];

  let submitPayload: Record<string, unknown> | null = null;
  let lastModel = `${cfg.provider}/${cfg.model}`;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations += 1;
    if (Date.now() - startedAt > TIMEOUT_MS) {
      throw new Error("Workflow Architect timed out");
    }

    const response = await llmChatWithTools(messages, WORKFLOW_ARCHITECT_READ_TOOLS, {
      temperature: 0.15,
      maxTokens: 4000,
      providerChain,
    });
    if (!response) throw new Error("Workflow Architect returned no response");

    lastModel = `${response.provider}:${response.model}`;
    messages.push({
      role: "assistant",
      content: response.message.content,
      tool_calls: response.message.tool_calls,
    });

    if (!response.message.tool_calls?.length) {
      break;
    }

    for (const call of response.message.tool_calls) {
      const name = call.function.name;
      toolCalls.push(name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (name === "submit_workflow_draft") {
        submitPayload = args;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: stringifyToolResult({ status: "completed", data: { accepted: true } }),
        });
        continue;
      }

      const toolResult = await executeWorkflowArchitectTool(name, args, ctx);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: stringifyToolResult(toolResult),
      });
    }

    if (submitPayload) break;
  }

  const record: WorkflowArchitectInvocationRecord = {
    requestId,
    runtimeId: "appointment_workflow_architect",
    creationMode: "llm_architect",
    model: lastModel,
    promptVersion: "2026.08.07.1",
    nodeCatalogVersion: "2026.08.07.1",
    toolCalls,
    latencyMs: Date.now() - startedAt,
  };

  if (!submitPayload) {
    return {
      result: {
        status: "needs_information",
        summary: "Workflow Architect did not submit a structured draft within the iteration limit.",
        interpretation: ctx.userRequest,
        requiredResources: [],
        missingInformation: ["Could not complete draft — try a more specific request or retry."],
        nodes: [],
        edges: [],
        changedNodes: [],
        removedNodes: [],
        invariantsChecked: [...WORKFLOW_INVARIANTS],
        risks: [{ code: "no_submission", level: "medium", description: "LLM did not call submit_workflow_draft" }],
        requiredTests: [],
        creationMode: "llm_architect",
        architectInvocation: record,
      },
      record,
    };
  }

  const status = String(submitPayload.status || "needs_information") as WorkflowArchitectResult["status"];

  if (status === "unsupported") {
    return {
      result: {
        status: "unsupported",
        summary: String(submitPayload.summary || submitPayload.reason || "Unsupported request"),
        interpretation: String(submitPayload.interpretation || ctx.userRequest),
        requiredResources: [],
        missingInformation: (submitPayload.unsupportedRequirements as string[]) || [],
        nodes: [],
        edges: [],
        changedNodes: [],
        removedNodes: [],
        invariantsChecked: [],
        risks: [{ code: "unsupported", level: "high", description: String(submitPayload.reason || "") }],
        requiredTests: [],
        nearestSupportedAlternative: submitPayload.nearestSupportedAlternative as string | undefined,
        creationMode: "llm_architect",
        architectInvocation: record,
      },
      record,
    };
  }

  if (status === "needs_information") {
    const missing = (submitPayload.missingInformation as Array<{ key?: string; question?: string }>) || [];
    return {
      result: {
        status: "needs_information",
        summary: String(submitPayload.summary || "More information required"),
        interpretation: String(submitPayload.interpretation || ctx.userRequest),
        requiredResources: missing.map((m) => m.key || m.question || "").filter(Boolean),
        missingInformation: missing.map((m) => m.question || m.key || "").filter(Boolean),
        nodes: [],
        edges: [],
        changedNodes: [],
        removedNodes: [],
        invariantsChecked: [...WORKFLOW_INVARIANTS].slice(0, 4),
        risks: [],
        requiredTests: generateWorkflowTestPlan({ userRequest: ctx.userRequest, nodeTypes: [] }),
        creationMode: "llm_architect",
        architectInvocation: record,
      },
      record,
    };
  }

  const nodes = (submitPayload.nodes || []) as WorkflowDraft["nodes"];
  const edges = (submitPayload.edges || []) as WorkflowDraft["edges"];
  const draft: WorkflowDraft = {
    id: createId(),
    agentId: ctx.agentId,
    name: String(submitPayload.name || submitPayload.summary || "Workflow draft"),
    version: 1,
    triggerNodeId: String(submitPayload.triggerNodeId || nodes[0]?.id || "trigger"),
    nodes,
    edges,
    validationStatus: "not_validated",
    validationErrors: [],
    requiresConfirmation: true,
    status: "draft",
    createdAt: new Date().toISOString(),
    sourceRequest: ctx.userRequest,
  };

  const structural = validateWorkflowDraft(draft);
  const semantic = validateWorkflowSemantics(structural);
  const semanticBlocking = semanticErrorsBlockDraft(semantic);

  if (structural.validationStatus !== "valid" || semanticBlocking) {
    const allErrors = [
      ...structural.validationErrors.map((e) => e.message),
      ...semantic.filter((e) => e.level === "error").map((e) => e.message),
    ];
    return {
      result: {
        status: "needs_information",
        summary: `Draft failed validation: ${allErrors.slice(0, 3).join("; ")}`,
        interpretation: String(submitPayload.interpretation || ctx.userRequest),
        requiredResources: [],
        missingInformation: allErrors,
        nodes: structural.nodes,
        edges: structural.edges,
        changedNodes: structural.nodes.map((n) => n.id),
        removedNodes: [],
        invariantsChecked: [...WORKFLOW_INVARIANTS],
        risks: semantic
          .filter((e) => e.level === "error")
          .map((e) => ({ code: e.code, level: "high" as const, description: e.message })),
        requiredTests: generateWorkflowTestPlan({
          userRequest: ctx.userRequest,
          nodeTypes: structural.nodes.map((n) => n.type),
        }),
        creationMode: "llm_architect",
        architectInvocation: record,
      },
      record,
      draft: structural,
    };
  }

  const diff = graphDiff(baseTemplate, structural);
  record.draftId = structural.id;

  return {
    result: {
      status: "draft_created",
      summary: String(submitPayload.summary || `Draft "${structural.name}" created.`),
      interpretation: String(submitPayload.interpretation || ctx.userRequest),
      requiredResources: ctx.phoneNumberId ? [`phone:${ctx.phoneNumberId}`] : [],
      missingInformation: [],
      nodes: structural.nodes,
      edges: structural.edges,
      changedNodes: diff.addedNodeIds.concat(diff.updatedNodeIds),
      removedNodes: diff.removedNodeIds,
      addedNodeIds: diff.addedNodeIds,
      updatedNodeIds: diff.updatedNodeIds,
      unchangedNodeIds: diff.unchangedNodeIds,
      invariantsChecked: [...WORKFLOW_INVARIANTS],
      risks: semantic
        .filter((e) => e.level === "warning")
        .map((e) => ({ code: e.code, level: "medium" as const, description: e.message })),
      requiredTests: generateWorkflowTestPlan({
        userRequest: ctx.userRequest,
        nodeTypes: structural.nodes.map((n) => n.type),
        addedNodeIds: diff.addedNodeIds,
      }),
      assumptions: (submitPayload.assumptions as string[]) || [],
      draftId: structural.id,
      creationMode: "llm_architect",
      architectInvocation: record,
      graphDiff: diff,
    },
    record,
    draft: structural,
  };
}

export function hasWorkflowArchitectLlmConfigured(): boolean {
  return resolveLlmProvidersForRuntime("workflow_architect").length > 0;
}
