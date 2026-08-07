/**
 * John MCTB — first-class runtime registry (customer John + Workflow Architect).
 */

import { JOHN_PROMPT_VERSION } from "./john-prompt";
import { getJohnRuntimeModelConfig } from "./model-config";
import type { JohnRuntimeId } from "./types";

export type JohnRuntimeDefinition = {
  runtimeId: JohnRuntimeId;
  label: string;
  purpose: string;
  promptSource: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  toolIds: string[];
  contextSources: string[];
  prohibitedActions: string[];
};

export const JOHN_RUNTIME_REGISTRY: JohnRuntimeDefinition[] = [
  {
    runtimeId: "customer_john",
    label: "Customer John",
    purpose: "LLM-backed SMS conversations with missed callers.",
    promptSource:
      "src/lib/agents/missed-call-text-back/intelligence/john-prompt.ts → buildJohnSystemPrompt",
    promptVersion: JOHN_PROMPT_VERSION,
    modelProvider: getJohnRuntimeModelConfig("customer_john").provider,
    modelName: getJohnRuntimeModelConfig("customer_john").model,
    toolIds: ["john_runtime_turn"],
    contextSources: [
      "runtime_context",
      "business_context",
      "conversation_history",
      "known_information",
      "required_information",
    ],
    prohibitedActions: [
      "direct_sms_send",
      "invent_workflow_steps",
      "claim_success_without_runtime",
      "keyword_routing",
    ],
  },
  {
    runtimeId: "mctb_workflow_architect",
    label: "MCTB Workflow Architect",
    purpose: "Creates and modifies John missed-call-text-back workflow definitions.",
    promptSource:
      "src/lib/agents/missed-call-text-back/intelligence/workflow-architect-mctb.ts",
    promptVersion: JOHN_PROMPT_VERSION,
    modelProvider: getJohnRuntimeModelConfig("mctb_workflow_architect").provider,
    modelName: getJohnRuntimeModelConfig("mctb_workflow_architect").model,
    toolIds: [
      "list_mctb_nodes",
      "build_mctb_workflow_draft",
      "validate_mctb_workflow",
      "simulate_mctb_workflow",
    ],
    contextSources: [
      "mctb_node_catalog",
      "current_workflow",
      "owner_request",
      "mctb_settings",
    ],
    prohibitedActions: [
      "activate_production_directly",
      "invent_unregistered_nodes",
      "generate_arbitrary_code",
    ],
  },
];

export function getJohnRuntime(id: JohnRuntimeId): JohnRuntimeDefinition | undefined {
  return JOHN_RUNTIME_REGISTRY.find((r) => r.runtimeId === id);
}
