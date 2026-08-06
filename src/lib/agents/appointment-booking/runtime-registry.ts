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
};

export const AMY_RUNTIME_REGISTRY: AgentRuntimeDefinition[] = [
  {
    id: "caller_amy",
    label: "Caller Amy",
    purpose: "Handles live phone conversations with callers.",
    promptSource:
      "src/lib/solutions/appointment-receptionist/build-agent-config.ts → VoiceAgentConfig.instructions → Telnyx assistant.instructions",
    contextLoaders: [
      "Company Brain (approved facts only)",
      "Amy profile + active AgentVersion booking policy",
      "Current call context (ANI, DID, hold state)",
      "Approved booking tools",
      "Workflow constraints (required fields, transfer/fallback gates)",
    ],
    modelSettings: {
      provider: "telnyx",
      modelHint: "Telnyx AI Assistant (voice)",
      temperatureHint: 0.3,
    },
    tools: [
      "resolve_datetime",
      "calendar_availability",
      "hold_appointment_slot",
      "release_appointment_hold",
      "book_appointment",
      "reschedule_appointment",
      "cancel_appointment",
      "send_sms",
      "transfer_call",
    ],
    writePermission: "live_tools",
    fallback:
      "If tools fail: take a message / transfer per AgentVersion.fallbackPolicy — never invent availability.",
  },
  {
    id: "owner_amy",
    label: "Owner Amy",
    purpose: "Manages and explains Amy inside Transovo (Talk to Amy).",
    promptSource: "src/lib/agents/appointment-booking/owner-chat.ts",
    contextLoaders: [
      "Control API tools only (no raw DB writes)",
      "Agent summary, health, metrics, attention, readiness",
      "Evidence links (call, appointment, proposal, health)",
      "Setup readiness when not yet live",
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
      "create_change_proposal",
      "confirm_change_proposal",
      "run_agent_test_suite",
      "get_deployment_drift",
    ],
    writePermission: "proposal_only",
    fallback: "If unsure, ask a clarifying question or open Settings — never mute production silently.",
  },
  {
    id: "appointment_workflow_architect",
    label: "Appointment Workflow Architect",
    purpose: "Builds approved AutomationFlow node graphs (around-call / post-call).",
    promptSource: "src/lib/agents/appointment-booking/workflow-architect.ts",
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
    writePermission: "draft_only",
    fallback: "Invalid graphs stay draft; promote requires validation + owner confirm.",
  },
  {
    id: "diagnostic_specialist",
    label: "Diagnostic specialist",
    purpose: "Reads execution traces and explains failures.",
    promptSource: "src/lib/agents/appointment-booking/execution-trace.ts",
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
    ],
    writePermission: "none",
    fallback: "Return Not verified when evidence is incomplete — never invent root cause.",
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
    promptSource: r.promptSource,
    model: `${r.modelSettings.provider}:${r.modelSettings.modelHint}`,
    tools: r.tools,
    writePermission: r.writePermission,
    fallback: r.fallback,
  }));
}
