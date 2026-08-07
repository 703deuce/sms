/**
 * First-class runtime registry — specialized Amy runtimes with prompts, tools, context, writes.
 */

import {
  OWNER_AMY_TOOL_DESCRIPTIONS,
  WORKFLOW_ARCHITECT_TOOL_DESCRIPTIONS,
} from "@/lib/agents/appointment-booking/intelligence/tool-descriptions";
import { getPromptVersionRecord } from "@/lib/agents/appointment-booking/intelligence/prompt-versioning";
import type { AgentRuntimeDefinition, AgentRuntimeId } from "@/lib/agents/appointment-booking/intelligence/types";

export type { AgentRuntimeDefinition, AgentRuntimeId };

export const AMY_RUNTIME_REGISTRY: AgentRuntimeDefinition[] = [
  {
    runtimeId: "caller_amy",
    agentRole: "caller_booking",
    label: "Caller Amy",
    purpose: "Handles live phone conversations with callers.",
    promptSource:
      "src/lib/agents/appointment-booking/intelligence/caller-prompt.ts → buildCallerAmyPromptFromModules",
    promptVersion: getPromptVersionRecord("caller_amy").promptVersion,
    modelProvider: "telnyx",
    modelName: "anthropic/claude-haiku-4-5",
    toolIds: [
      "resolve_datetime",
      "calendar_availability",
      "hold_appointment_slot",
      "release_appointment_hold",
      "book_appointment",
      "find_appointments",
      "reschedule_appointment",
      "cancel_appointment",
      "send_sms",
      "transfer",
      "escalate_human",
      "save_caller_info",
      "take_structured_message",
      "lookup_customer",
      "hangup",
    ],
    contextSources: [
      "agent_identity",
      "booking_profile",
      "approved_business_context",
      "custom_collection_fields",
      "booking_confirmation_policy",
      "date_time_policy",
      "tool_policy",
      "transfer_policy",
      "fallback_policy",
      "current_call_context",
    ],
    allowedWrites: ["live_tools"],
    prohibitedActions: [
      "change_own_configuration",
      "invent_availability",
      "claim_booking_without_verification",
      "bypass_quiet_hours",
    ],
    timeoutMs: 120_000,
    fallbackRuntimeId: undefined,
    maxContextBudget: 16_000,
    retrievalPolicy: "approved_facts_and_active_version_only",
  },
  {
    runtimeId: "owner_amy",
    agentRole: "owner_controller",
    label: "Owner Amy",
    purpose: "Owner-facing control agent inside Transovo (Talk to Amy).",
    promptSource:
      "src/lib/agents/appointment-booking/intelligence/owner-runtime.ts → buildOwnerAmySystemPrompt",
    promptVersion: getPromptVersionRecord("owner_amy").promptVersion,
    modelProvider: "llm",
    modelName: process.env.OPENAI_MODEL?.trim() ||
      process.env.DEEPSEEK_MODEL?.trim() ||
      process.env.LLM_MODEL?.trim() ||
      "gpt-4o-mini",
    toolIds: OWNER_AMY_TOOL_DESCRIPTIONS.map((t) => t.id),
    contextSources: [
      "agent_identity",
      "responsibility_summary",
      "workspace_id",
      "agent_version_id",
      "user_permission_level",
      "capability_summary",
      "safety_policy",
      "local_datetime",
      "full_settings",
      "workflow_graph",
      "calls",
      "execution_traces",
      "metrics",
      "health_details",
      "knowledge_records",
      "test_results",
      "version_history",
    ],
    allowedWrites: ["proposal_only", "draft_only", "queued_jobs"],
    prohibitedActions: [
      "direct_database_write",
      "silent_production_mutation",
      "arbitrary_code_execution",
      "cross_workspace_access",
      "invent_metrics_or_logs",
    ],
    timeoutMs: 45_000,
    fallbackRuntimeId: undefined,
    maxContextBudget: 12_000,
    retrievalPolicy: "selective_on_demand",
  },
  {
    runtimeId: "appointment_workflow_architect",
    agentRole: "workflow_architect",
    label: "Appointment Workflow Architect",
    purpose: "Creates valid AutomationFlow drafts for appointment agents.",
    promptSource:
      "src/lib/agents/appointment-booking/intelligence/workflow-architect-runtime.ts",
    promptVersion: getPromptVersionRecord("appointment_workflow_architect").promptVersion,
    modelProvider: "internal",
    modelName: "template_constraint_validator",
    toolIds: WORKFLOW_ARCHITECT_TOOL_DESCRIPTIONS.map((t) => t.id),
    contextSources: [
      "approved_block_registry",
      "block_schemas",
      "current_primary_workflow",
      "owner_request",
      "booking_profile",
      "assigned_resources",
      "workflow_invariants",
      "test_catalog",
    ],
    allowedWrites: ["draft_only"],
    prohibitedActions: [
      "activate_production",
      "generate_code",
      "invent_block_types",
      "direct_database_write",
    ],
    timeoutMs: 30_000,
    fallbackRuntimeId: undefined,
    maxContextBudget: 10_000,
    retrievalPolicy: "full_block_registry_on_invoke",
  },
  {
    runtimeId: "diagnostic_specialist",
    agentRole: "diagnostic",
    label: "Diagnostic specialist",
    purpose: "Reads execution traces and explains failures with evidence.",
    promptSource:
      "src/lib/agents/appointment-booking/intelligence/diagnostic-runtime.ts",
    promptVersion: getPromptVersionRecord("diagnostic_specialist").promptVersion,
    modelProvider: "internal",
    modelName: "structured_trace_analyzer",
    toolIds: [
      "get_call_trace",
      "search_failures",
      "get_agent_health",
      "verify_live_drift",
      "get_booking_verification",
    ],
    contextSources: [
      "execution_traces",
      "tool_call_results",
      "health_events",
      "deployment_state",
      "configuration_snapshot",
    ],
    allowedWrites: [],
    prohibitedActions: [
      "speculate_without_evidence",
      "invent_root_cause",
      "mutate_configuration",
    ],
    timeoutMs: 20_000,
    fallbackRuntimeId: undefined,
    maxContextBudget: 8_000,
    retrievalPolicy: "trace_only_no_speculation",
  },
];

export function getRuntime(runtimeId: AgentRuntimeId): AgentRuntimeDefinition {
  const found = AMY_RUNTIME_REGISTRY.find((r) => r.runtimeId === runtimeId);
  if (!found) throw new Error(`Unknown runtime: ${runtimeId}`);
  return found;
}

export function runtimeRegistrySummary() {
  return AMY_RUNTIME_REGISTRY.map((r) => {
    const prompt = getPromptVersionRecord(r.runtimeId);
    return {
      runtimeId: r.runtimeId,
      agentRole: r.agentRole,
      label: r.label,
      promptSource: r.promptSource,
      promptVersion: r.promptVersion,
      promptHash: prompt.hash,
      model: `${r.modelProvider}:${r.modelName}`,
      toolCount: r.toolIds.length,
      tools: r.toolIds,
      contextSources: r.contextSources,
      allowedWrites: r.allowedWrites,
      prohibitedActions: r.prohibitedActions,
      fallbackRuntimeId: r.fallbackRuntimeId,
      maxContextBudget: r.maxContextBudget,
      retrievalPolicy: r.retrievalPolicy,
      lastDeployment: prompt.deployedAt,
    };
  });
}

/** Audit table for intelligence layer gap analysis. */
export function buildRuntimeAuditTable() {
  return AMY_RUNTIME_REGISTRY.map((r) => {
    const prompt = getPromptVersionRecord(r.runtimeId);
    const gaps: string[] = [];
    if (r.agentRole === "owner_controller" && r.modelProvider === "llm") {
      gaps.push("LLM tool loop — requires OPENAI_API_KEY or DEEPSEEK_API_KEY");
    }
    if (r.agentRole === "caller_booking") {
      gaps.push("Live path via Telnyx — backend controls tool execution");
    }
    if (r.agentRole === "workflow_architect") {
      gaps.push("Regex/template mapping — extend for complex multi-branch NL");
    }
    return {
      runtime: r.label,
      currentPrompt: r.promptSource,
      currentModel: `${r.modelProvider}:${r.modelName}`,
      currentTools: r.toolIds.length,
      currentContext: r.contextSources.length,
      currentWrites: r.allowedWrites.join(", ") || "none",
      promptHash: prompt.hash,
      promptVersion: prompt.promptVersion,
      gap: gaps.join("; ") || "Intelligence layer implemented",
    };
  });
}
