/**
 * Structured capability catalog — Owner Amy inspects this before promising action.
 */

import type { AgentCapability, OwnerRequestIntent } from "./types";

export const OWNER_AMY_CAPABILITIES: AgentCapability[] = [
  {
    id: "explain_agent_setup",
    label: "Explain my setup",
    description:
      "Describe responsibilities, assigned resources, booking policy, and current status.",
    category: "read",
    requiredTools: ["get_agent_overview", "get_agent_responsibility", "get_agent_settings"],
    requiredPermissions: ["agent:read"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "search_recent_calls",
    label: "Search recent calls",
    description: "List recent call activity with outcomes and links.",
    category: "read",
    requiredTools: ["search_calls"],
    requiredPermissions: ["agent:read", "calls:read"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "explain_call_failure",
    label: "Explain a call failure",
    description:
      "Retrieve execution trace and delegate detailed interpretation to the Diagnostic specialist.",
    category: "diagnose",
    requiredTools: ["get_call_trace", "search_failures"],
    requiredPermissions: ["agent:read", "calls:read"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "report_booking_metrics",
    label: "Report booking metrics",
    description: "Summarize calls, bookings, conversion, and trends for a time window.",
    category: "read",
    requiredTools: ["get_agent_metrics"],
    requiredPermissions: ["agent:read"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "propose_booking_rule_change",
    label: "Change booking rules",
    description:
      "Create a typed booking-policy proposal with before/after diff; never silent production writes.",
    category: "configure",
    requiredTools: ["create_booking_policy_proposal", "get_agent_settings"],
    requiredPermissions: ["agent:configure"],
    requiredResources: [],
    riskLevel: "medium",
    confirmationRequired: true,
  },
  {
    id: "add_collection_field",
    label: "Add required information",
    description:
      "Propose a structured collection field with question, validation, and save destinations.",
    category: "configure",
    requiredTools: ["create_collection_field_proposal", "get_agent_settings"],
    requiredPermissions: ["agent:configure"],
    requiredResources: [],
    riskLevel: "medium",
    confirmationRequired: true,
  },
  {
    id: "create_workflow_draft",
    label: "Build a workflow",
    description:
      "Delegate graph construction to the Workflow Architect; validate before explaining.",
    category: "workflow",
    requiredTools: ["request_workflow_draft", "validate_workflow_draft"],
    requiredPermissions: ["agent:workflow"],
    requiredResources: ["primary_workflow"],
    riskLevel: "medium",
    confirmationRequired: true,
  },
  {
    id: "modify_workflow_draft",
    label: "Modify workflow draft",
    description: "Request changes to an existing draft through the Workflow Architect.",
    category: "workflow",
    requiredTools: ["request_workflow_draft", "get_workflow_draft", "validate_workflow_draft"],
    requiredPermissions: ["agent:workflow"],
    requiredResources: ["primary_workflow"],
    riskLevel: "medium",
    confirmationRequired: true,
  },
  {
    id: "run_simulation_suite",
    label: "Run simulations",
    description: "Execute the mock simulation suite and report pass/fail per scenario.",
    category: "test",
    requiredTools: ["run_simulation", "get_test_results"],
    requiredPermissions: ["agent:test"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "request_live_test",
    label: "Request live test",
    description: "Queue a live WebRTC or PSTN test job; report queued status honestly.",
    category: "test",
    requiredTools: ["request_live_test", "get_test_job_status"],
    requiredPermissions: ["agent:test"],
    requiredResources: ["telnyx_assistant"],
    riskLevel: "low",
    confirmationRequired: false,
  },
  {
    id: "activate_agent_version",
    label: "Put version live",
    description: "Request version activation through the Control API after tests and approval.",
    category: "deploy",
    requiredTools: ["request_version_activation", "confirm_version_activation"],
    requiredPermissions: ["agent:deploy"],
    requiredResources: ["telnyx_assistant"],
    riskLevel: "high",
    confirmationRequired: true,
  },
  {
    id: "rollback_agent_version",
    label: "Rollback version",
    description: "Roll back to a prior AgentVersion after verification.",
    category: "deploy",
    requiredTools: ["rollback_version", "verify_live_drift"],
    requiredPermissions: ["agent:deploy"],
    requiredResources: ["telnyx_assistant"],
    riskLevel: "high",
    confirmationRequired: true,
  },
  {
    id: "duplicate_agent",
    label: "Create another agent",
    description: "Duplicate into a new draft; phone and calendar must be reassigned.",
    category: "duplicate",
    requiredTools: ["duplicate_agent_draft"],
    requiredPermissions: ["agent:create"],
    requiredResources: [],
    riskLevel: "medium",
    confirmationRequired: true,
  },
  {
    id: "review_knowledge_conflicts",
    label: "Review knowledge",
    description: "Summarize approved facts, pending items, and conflicts in Company Brain.",
    category: "knowledge",
    requiredTools: ["get_knowledge_summary"],
    requiredPermissions: ["agent:read", "knowledge:read"],
    requiredResources: [],
    riskLevel: "low",
    confirmationRequired: false,
  },
];

/** UI shortcuts in Talk to Amy — map directly to capabilities. */
export const AMY_CAPABILITY_SHORTCUTS = [
  {
    id: "ask_about_work",
    label: "Ask about my work",
    prompt: "How did today go? What appointments did you book this week?",
    capabilityId: "report_booking_metrics",
  },
  {
    id: "change_booking",
    label: "Change how I book",
    prompt: "Explain how you book appointments and what rules you follow.",
    capabilityId: "explain_agent_setup",
  },
  {
    id: "teach_rule",
    label: "Teach me a rule",
    prompt: "Require email for water-heater appointments.",
    capabilityId: "propose_booking_rule_change",
  },
  {
    id: "build_workflow",
    label: "Build a workflow",
    prompt: "Create an after-hours emergency workflow draft.",
    capabilityId: "create_workflow_draft",
  },
  {
    id: "test_setup",
    label: "Test my setup",
    prompt: "Test yourself.",
    capabilityId: "run_simulation_suite",
  },
  {
    id: "fix_problem",
    label: "Fix a problem",
    prompt: "Why didn't the last caller book?",
    capabilityId: "explain_call_failure",
  },
  {
    id: "create_another",
    label: "Create another Amy",
    prompt: "Create another Amy for Richmond.",
    capabilityId: "duplicate_agent",
  },
] as const;

const INTENT_CAPABILITY_MAP: Partial<Record<OwnerRequestIntent, string[]>> = {
  read_information: [
    "explain_agent_setup",
    "search_recent_calls",
    "report_booking_metrics",
    "review_knowledge_conflicts",
  ],
  explain_activity: ["search_recent_calls", "report_booking_metrics"],
  diagnose_failure: ["explain_call_failure"],
  change_configuration: ["propose_booking_rule_change", "add_collection_field"],
  build_workflow: ["create_workflow_draft", "modify_workflow_draft"],
  run_test: ["run_simulation_suite", "request_live_test"],
  deploy_version: ["activate_agent_version", "rollback_agent_version"],
  duplicate_agent: ["duplicate_agent"],
  manage_knowledge: ["review_knowledge_conflicts", "propose_booking_rule_change"],
};

export function getCapability(id: string): AgentCapability | undefined {
  return OWNER_AMY_CAPABILITIES.find((c) => c.id === id);
}

export function capabilitiesForIntent(intent: OwnerRequestIntent): AgentCapability[] {
  const ids = INTENT_CAPABILITY_MAP[intent] || [];
  return ids
    .map((id) => getCapability(id))
    .filter((c): c is AgentCapability => Boolean(c));
}

export function capabilitySummaryForPrompt(): string {
  return OWNER_AMY_CAPABILITIES.map(
    (c) => `- ${c.id} (${c.category}, risk ${c.riskLevel}): ${c.description}`,
  ).join("\n");
}
