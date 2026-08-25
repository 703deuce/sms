/**
 * Selective context-loading policy — layered context per runtime.
 */

import type { AgentRuntimeId, OwnerRequestIntent } from "./types";

export type ContextLayer = "always" | "on_demand" | "never";

export type ContextSourceRule = {
  source: string;
  layer: ContextLayer;
  maxTokens?: number;
  loadWhen?: OwnerRequestIntent[];
};

export const OWNER_AMY_CONTEXT_POLICY: ContextSourceRule[] = [
  { source: "agent_identity", layer: "always" },
  { source: "agent_type", layer: "always" },
  { source: "responsibility_summary", layer: "always" },
  { source: "workspace_id", layer: "always" },
  { source: "agent_version_id", layer: "always" },
  { source: "user_permission_level", layer: "always" },
  { source: "capability_summary", layer: "always" },
  { source: "safety_policy", layer: "always" },
  { source: "local_datetime", layer: "always" },
  {
    source: "full_settings",
    layer: "on_demand",
    maxTokens: 2000,
    loadWhen: ["read_information", "change_configuration"],
  },
  {
    source: "workflow_graph",
    layer: "on_demand",
    maxTokens: 4000,
    loadWhen: ["build_workflow", "read_information"],
  },
  {
    source: "calls",
    layer: "on_demand",
    maxTokens: 1500,
    loadWhen: ["explain_activity", "diagnose_failure"],
  },
  {
    source: "execution_traces",
    layer: "on_demand",
    maxTokens: 3000,
    loadWhen: ["diagnose_failure"],
  },
  {
    source: "metrics",
    layer: "on_demand",
    maxTokens: 800,
    loadWhen: ["explain_activity", "read_information"],
  },
  {
    source: "health_details",
    layer: "on_demand",
    maxTokens: 1000,
    loadWhen: ["read_information", "diagnose_failure"],
  },
  {
    source: "knowledge_records",
    layer: "on_demand",
    maxTokens: 2000,
    loadWhen: ["manage_knowledge", "read_information"],
  },
  {
    source: "test_results",
    layer: "on_demand",
    maxTokens: 1000,
    loadWhen: ["run_test", "deploy_version"],
  },
  {
    source: "version_history",
    layer: "on_demand",
    maxTokens: 1000,
    loadWhen: ["deploy_version"],
  },
  { source: "all_historical_calls", layer: "never" },
  { source: "every_transcript", layer: "never" },
  { source: "full_company_brain", layer: "never" },
  { source: "all_workflow_versions", layer: "never" },
  { source: "all_logs", layer: "never" },
  { source: "secrets", layer: "never" },
  { source: "unrelated_contacts", layer: "never" },
];

export const CALLER_AMY_CONTEXT_POLICY: ContextSourceRule[] = [
  { source: "agent_identity", layer: "always" },
  { source: "booking_profile", layer: "always" },
  { source: "approved_business_context", layer: "always" },
  { source: "custom_collection_fields", layer: "always" },
  { source: "booking_confirmation_policy", layer: "always" },
  { source: "date_time_policy", layer: "always" },
  { source: "tool_policy", layer: "always" },
  { source: "transfer_policy", layer: "always" },
  { source: "fallback_policy", layer: "always" },
  { source: "current_call_context", layer: "on_demand", loadWhen: [] },
  { source: "full_company_brain", layer: "never" },
  { source: "owner_settings", layer: "never" },
];

export function contextSourcesForIntent(
  runtimeId: AgentRuntimeId,
  intent?: OwnerRequestIntent,
): string[] {
  const policy =
    runtimeId === "caller_amy" ? CALLER_AMY_CONTEXT_POLICY : OWNER_AMY_CONTEXT_POLICY;

  const always = policy.filter((r) => r.layer === "always").map((r) => r.source);
  if (!intent) return always;

  const onDemand = policy
    .filter(
      (r) =>
        r.layer === "on_demand" &&
        (!r.loadWhen?.length || r.loadWhen.includes(intent)),
    )
    .map((r) => r.source);

  return [...always, ...onDemand];
}

export function estimateContextBudget(
  runtimeId: AgentRuntimeId,
  intent?: OwnerRequestIntent,
): number {
  const policy =
    runtimeId === "caller_amy" ? CALLER_AMY_CONTEXT_POLICY : OWNER_AMY_CONTEXT_POLICY;
  const sources = contextSourcesForIntent(runtimeId, intent);
  return policy
    .filter((r) => sources.includes(r.source))
    .reduce((sum, r) => sum + (r.maxTokens || 500), 0);
}
