/**
 * Maps Owner Amy LLM tool names → Agent Control API commands.
 */

import type { AgentControlCommand } from "@/lib/agents/appointment-booking/types";
import type { LlmToolDefinition } from "@/lib/ai/llm-tools";

export type OwnerToolSpec = {
  command: AgentControlCommand;
  /** Never callable from the LLM loop (prevents recursion). */
  blocked?: boolean;
};

export const OWNER_LLM_TOOL_SPECS: Record<string, OwnerToolSpec> = {
  get_agent_overview: { command: "get_agent_summary" },
  get_agent_settings: { command: "get_agent_configuration" },
  get_agent_health: { command: "get_agent_health" },
  get_agent_metrics: { command: "get_agent_metrics" },
  get_agent_responsibility: { command: "get_agent_responsibility" },
  search_calls: { command: "search_agent_activity" },
  get_call_trace: { command: "get_employee_timeline" },
  get_execution_trace: { command: "get_execution_trace" },
  explain_call_failure: { command: "explain_call_failure" },
  get_booking_verification: { command: "get_booking_verification" },
  get_pending_attention: { command: "get_attention_inbox" },
  get_knowledge_summary: { command: "get_memory_view" },
  get_setup_readiness: { command: "get_setup_readiness" },
  verify_live_drift: { command: "get_deployment_drift" },
  get_current_version: { command: "list_versions" },
  list_change_proposals: { command: "list_change_proposals" },
  create_booking_policy_proposal: { command: "create_change_proposal" },
  confirm_change_proposal: { command: "confirm_change_proposal" },
  reject_change_proposal: { command: "reject_change_proposal" },
  propose_setup_change: { command: "propose_setup_change" },
  request_workflow_draft: { command: "create_workflow_draft" },
  list_workflow_drafts: { command: "list_workflow_drafts" },
  validate_workflow_draft: { command: "validate_workflow_draft" },
  promote_workflow_draft: { command: "promote_workflow_draft" },
  run_simulation: { command: "run_agent_simulation" },
  run_regression_suite: { command: "run_agent_test_suite" },
  request_version_activation: { command: "activate_agent_version" },
  rollback_version: { command: "rollback_agent_version" },
  duplicate_agent_draft: { command: "duplicate_agent" },
  pause_agent: { command: "pause_agent" },
  resume_agent: { command: "resume_agent" },
  get_daily_report: { command: "get_daily_report" },
  owner_ask: { command: "owner_ask", blocked: true },
};

const OBJECT = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

export const OWNER_LLM_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_agent_overview",
      description: "Identity, phone, calendar, health summary, and headline metrics.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_responsibility",
      description: "What this agent is allowed and not allowed to do.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_settings",
      description: "Booking policy, voice profile, and configuration.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_health",
      description: "Dependency health checks (calendar, Telnyx, drift).",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_metrics",
      description: "Calls answered, bookings, conversion, SMS counts for a time window.",
      parameters: OBJECT({
        windowDays: { type: "number", description: "Days to include (default 7)" },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "search_calls",
      description:
        "Search recent call activity. Use for 'last call', 'what happened', recent bookings, or failures.",
      parameters: OBJECT({
        limit: { type: "number", description: "Max calls (default 5)" },
        failuresOnly: {
          type: "boolean",
          description: "Only calls with failures or no booking",
        },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "get_call_trace",
      description:
        "Timeline and reasoning path for one call. Requires callId from search_calls.",
      parameters: OBJECT({ callId: { type: "string", description: "Voice call id" } }, [
        "callId",
      ]),
    },
  },
  {
    type: "function",
    function: {
      name: "get_execution_trace",
      description: "Full structured execution trace with tool steps for one call.",
      parameters: OBJECT({ callId: { type: "string" } }, ["callId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "explain_call_failure",
      description: "Diagnose why a specific call failed to book.",
      parameters: OBJECT({ callId: { type: "string" } }, ["callId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking_verification",
      description:
        "Verify calendar event, SMS, and stored outcome for a booking (by callId or appointmentId).",
      parameters: OBJECT({
        callId: { type: "string" },
        appointmentId: { type: "string" },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_attention",
      description: "Items needing owner review.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "list_change_proposals",
      description: "Pending configuration change proposals.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking_policy_proposal",
      description:
        "Draft a booking-policy change (notice hours, same-day rules, required fields). Not live until confirmed.",
      parameters: OBJECT({
        naturalLanguage: {
          type: "string",
          description: "Owner request in plain language",
        },
        summary: { type: "string", description: "Short summary of the change" },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "propose_setup_change",
      description:
        "Propose setup edits (bookingPolicy, voice greeting, or collection field). Requires explicit fields.",
      parameters: OBJECT({
        summary: { type: "string" },
        bookingPolicy: { type: "object", description: "Partial booking policy patch" },
        voice: { type: "object", description: "Voice/greeting patch" },
        collectionField: { type: "object", description: "Custom field definition" },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_change_proposal",
      description: "Confirm and optionally publish a pending proposal to the live phone line.",
      parameters: OBJECT({
        proposalId: { type: "string" },
        publish: {
          type: "boolean",
          description: "Publish to Telnyx after confirm (default true)",
        },
      }, ["proposalId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "request_workflow_draft",
      description: "Create a workflow draft from a natural-language request.",
      parameters: OBJECT({
        userRequest: { type: "string", description: "What workflow to build" },
      }, ["userRequest"]),
    },
  },
  {
    type: "function",
    function: {
      name: "run_simulation",
      description: "Run the mock simulation test suite.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "run_regression_suite",
      description: "Run the full regression scenario catalog.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "verify_live_drift",
      description: "Check whether live Telnyx deployment matches the expected version.",
      parameters: OBJECT({
        fetchRemote: { type: "boolean", description: "Fetch remote assistant state" },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_version",
      description: "List agent versions and which is active.",
      parameters: OBJECT({}),
    },
  },
];

export function normalizeOwnerToolPayload(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case "search_calls":
      return {
        limit: args.limit ?? 5,
        failuresOnly: args.failuresOnly ?? false,
        summariesOnly: false,
      };
    case "get_agent_metrics":
      return { windowDays: args.windowDays ?? 7 };
    case "create_booking_policy_proposal":
      return {
        naturalLanguage: args.naturalLanguage || args.summary,
        summary: args.summary,
      };
    case "confirm_change_proposal":
      return {
        proposalId: args.proposalId,
        confirm: true,
        publish: args.publish !== false,
      };
    case "request_workflow_draft":
      return { userRequest: args.userRequest };
    case "verify_live_drift":
      return { fetchRemote: args.fetchRemote ?? true };
    case "propose_setup_change":
      return {
        summary: args.summary,
        bookingPolicy: args.bookingPolicy,
        voice: args.voice,
        collectionField: args.collectionField,
      };
    default:
      return args;
  }
}

export async function executeOwnerLlmTool(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<unknown> {
  const spec = OWNER_LLM_TOOL_SPECS[input.toolName];
  if (!spec) {
    throw new Error(`Unknown tool: ${input.toolName}`);
  }
  if (spec.blocked) {
    throw new Error(`Tool ${input.toolName} is not callable from the owner agent loop`);
  }

  const { runAgentControlCommand } = await import(
    "@/lib/agents/appointment-booking/control"
  );
  const payload = normalizeOwnerToolPayload(input.toolName, input.args);
  return runAgentControlCommand({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    userId: input.userId,
    command: spec.command,
    payload,
  });
}

/** Truncate tool output for LLM context window. */
export function stringifyToolResult(data: unknown): string {
  const raw = JSON.stringify(data, null, 2);
  if (raw.length <= 12_000) return raw;
  return `${raw.slice(0, 12_000)}\n…[truncated]`;
}
