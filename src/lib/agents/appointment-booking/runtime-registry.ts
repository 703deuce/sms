/**
 * Specialized model runtimes for Amy — separate prompts, tools, permissions.
 * Live caller path remains Telnyx assistant + booking tools (not a second stack).
 */

export type RuntimeWritePermission =
  | "none"
  | "draft_only"
  | "proposal_only"
  | "publish_with_approval"
  | "live_tools";

export type AgentRuntimeDefinition = {
  id: "caller_amy" | "owner_amy" | "appointment_workflow_architect" | "diagnostic_specialist";
  label: string;
  purpose: string;
  /** Primary prompt / instruction source */
  promptSource: string;
  /** Supporting modules that assemble context */
  contextLoaders: string[];
  modelSettings: {
    provider: "telnyx" | "openai" | "internal";
    modelHint: string;
    temperatureHint: number;
  };
  tools: string[];
  writePermission: RuntimeWritePermission;
  fallback: string;
  mayAlways: string[];
  mustRequestApproval: string[];
  neverAllowed: string[];
};

export const AMY_RUNTIME_REGISTRY: AgentRuntimeDefinition[] = [
  {
    id: "caller_amy",
    label: "Caller Amy",
    purpose: "Handles live phone conversations with callers.",
    promptSource:
      "src/lib/agents/appointment-booking/prompts/caller-amy.ts + build-agent-config.ts → Telnyx assistant.instructions",
    contextLoaders: [
      "Company Brain (approved facts at publish time)",
      "Amy profile + active AgentVersion booking policy",
      "Current call context (ANI, DID, hold state)",
      "Approved booking tools",
      "Workflow constraints (required fields, transfer/fallback gates)",
    ],
    modelSettings: {
      provider: "telnyx",
      modelHint: "anthropic/claude-haiku-4-5 (default) with moonshotai/Kimi-K2.6 fallback",
      temperatureHint: 0.4,
    },
    tools: [
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
      "take_structured_message",
      "save_caller_info",
    ],
    writePermission: "live_tools",
    fallback:
      "If tools fail: take a message / transfer per AgentVersion.fallbackPolicy — never invent availability.",
    mayAlways: [
      "Answer approved calls on the assigned number",
      "Use approved booking tools",
      "Take structured messages when booking is unsafe",
    ],
    mustRequestApproval: [],
    neverAllowed: [
      "Invent availability or pricing",
      "Promise a booking after calendar failure",
      "Bypass required fields or compliance gates",
    ],
  },
  {
    id: "owner_amy",
    label: "Owner Amy",
    purpose: "Manages and explains Amy inside Transovo (Talk to Amy).",
    promptSource:
      "src/lib/agents/appointment-booking/prompts/owner-amy.ts → owner-chat.ts",
    contextLoaders: [
      "Control API tools only (no ad-hoc DB writes)",
      "Agent summary, health, metrics, attention, readiness",
      "Evidence links (call, appointment, proposal, health)",
      "Setup readiness when not yet live",
      "Daily report + recommendations",
    ],
    modelSettings: {
      provider: "internal",
      modelHint: "retrieval + structured proposal (deterministic handlers)",
      temperatureHint: 0,
    },
    tools: [
      "get_agent_summary",
      "get_agent_health",
      "get_agent_metrics",
      "search_agent_activity",
      "get_attention_inbox",
      "get_setup_readiness",
      "get_daily_report",
      "create_change_proposal",
      "confirm_change_proposal",
      "run_agent_test_suite",
      "run_agent_simulation",
      "get_deployment_drift",
      "duplicate_agent",
      "run_safe_auto_repair",
      "rollback_agent_version",
    ],
    writePermission: "publish_with_approval",
    fallback: "If unsure, ask a clarifying question or open Settings — never mute production silently.",
    mayAlways: [
      "Retrieve configuration, logs, health, metrics",
      "Create drafts and proposals",
      "Run simulations and test suites",
      "Explain failures from traces",
    ],
    mustRequestApproval: [
      "Live booking-rule / voice / field changes",
      "Activate version or promote workflow",
      "Duplicate into a new agent",
      "Assign calendar or number",
    ],
    neverAllowed: [
      "Write arbitrary code or change schema",
      "Reveal credentials",
      "Access unrelated workspaces",
      "Silently broaden permissions",
    ],
  },
  {
    id: "appointment_workflow_architect",
    label: "Appointment Workflow Architect",
    purpose: "Builds approved AutomationFlow node graphs (around-call / post-call).",
    promptSource:
      "src/lib/agents/appointment-booking/prompts/workflow-architect.ts → workflow-architect.ts",
    contextLoaders: [
      "Allowed appointment workflow blocks",
      "Current primary flow",
      "Owner request text",
    ],
    modelSettings: {
      provider: "internal",
      modelHint: "template + constraint validator",
      temperatureHint: 0,
    },
    tools: [
      "create_workflow_draft",
      "validate_workflow_draft",
      "promote_workflow_draft",
    ],
    // Drafts are free; promote is publish_with_approval (confirm required).
    writePermission: "publish_with_approval",
    fallback: "Invalid graphs stay draft; promote requires validation + owner confirm.",
    mayAlways: ["Create and validate workflow drafts from approved blocks"],
    mustRequestApproval: ["Promote / activate a workflow draft"],
    neverAllowed: ["Write application code", "Bypass graph validation", "Activate without confirm"],
  },
  {
    id: "diagnostic_specialist",
    label: "Diagnostic specialist",
    purpose: "Reads execution traces and explains failures.",
    promptSource:
      "src/lib/agents/appointment-booking/prompts/diagnostic-specialist.ts → execution-trace.ts",
    contextLoaders: [
      "Call execution trace",
      "Tool call results",
      "Health + drift",
      "Booking verification",
    ],
    modelSettings: {
      provider: "internal",
      modelHint: "structured explainTraceFailure",
      temperatureHint: 0,
    },
    tools: [
      "get_execution_trace",
      "explain_call_failure",
      "get_booking_verification",
      "get_agent_health",
      "get_deployment_drift",
      "get_employee_timeline",
    ],
    writePermission: "none",
    fallback: "Return Not verified when evidence is incomplete — never invent root cause.",
    mayAlways: ["Read traces, health, verification, drift", "Explain grounded failures"],
    mustRequestApproval: [],
    neverAllowed: ["Mutate configuration", "Invent root cause without evidence"],
  },
];

export function getRuntime(id: AgentRuntimeDefinition["id"]): AgentRuntimeDefinition {
  const found = AMY_RUNTIME_REGISTRY.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown runtime: ${id}`);
  return found;
}

export function runtimeRegistrySummary() {
  return AMY_RUNTIME_REGISTRY.map((r) => ({
    id: r.id,
    label: r.label,
    purpose: r.purpose,
    promptSource: r.promptSource,
    model: `${r.modelSettings.provider}:${r.modelSettings.modelHint}`,
    temperatureHint: r.modelSettings.temperatureHint,
    tools: r.tools,
    writePermission: r.writePermission,
    fallback: r.fallback,
    mayAlways: r.mayAlways,
    mustRequestApproval: r.mustRequestApproval,
    neverAllowed: r.neverAllowed,
    contextLoaders: r.contextLoaders,
  }));
}
