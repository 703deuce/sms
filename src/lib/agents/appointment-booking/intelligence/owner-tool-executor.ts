/**
 * Maps Owner Amy LLM tool names → Agent Control API commands with ToolResult semantics.
 */

import type { AgentControlCommand } from "@/lib/agents/appointment-booking/types";
import type { LlmToolDefinition } from "@/lib/ai/llm-tools";
import type { AgentToolDefinition } from "./types";
import { OWNER_AMY_TOOL_DESCRIPTIONS } from "./tool-descriptions";
import {
  stringifyToolResult,
  toolBlocked,
  toolCompleted,
  toolFailed,
  wrapToolOutput,
  type ToolResult,
} from "./tool-result";
import { diagnoseExecution } from "./diagnostic-runtime";
import { consumeActionConfirmation } from "./owner-confirmation";
import { assertOwnerToolAllowed } from "@/lib/platform/owner-runtime/guard";
import { canonicalOwnerTool, inferOwnerTaskFromIntent } from "@/lib/platform/owner-runtime/states";
import { defaultOwnerPermissions } from "@/lib/platform/owner-runtime/session";
import { isPlatformBlockedTool } from "@/lib/platform/agent-runtime/gateway";

export type OwnerToolSpec = {
  command?: AgentControlCommand;
  /** Never callable from the LLM loop (prevents recursion). */
  blocked?: boolean;
  /** Internal specialist — not a control command */
  specialist?: "diagnostic_specialist";
  riskLevel?: "read" | "low" | "medium" | "high";
  requiresConfirmation?: boolean;
};

export const OWNER_LLM_TOOL_SPECS: Record<string, OwnerToolSpec> = {
  get_agent_overview: { command: "get_agent_summary", riskLevel: "read" },
  get_agent_capabilities: { command: "get_agent_responsibility", riskLevel: "read" },
  get_agent_settings: { command: "get_agent_configuration", riskLevel: "read" },
  get_agent_resources: { command: "get_agent_summary", riskLevel: "read" },
  get_agent_health: { command: "get_agent_health", riskLevel: "read" },
  get_agent_metrics: { command: "get_agent_metrics", riskLevel: "read" },
  get_agent_responsibility: { command: "get_agent_responsibility", riskLevel: "read" },
  search_calls: { command: "search_agent_activity", riskLevel: "read" },
  search_agent_activity: { command: "search_agent_activity", riskLevel: "read" },
  get_call_trace: { command: "get_execution_trace", riskLevel: "read" },
  get_execution_trace: { command: "get_execution_trace", riskLevel: "read" },
  explain_call_failure: { command: "explain_call_failure", riskLevel: "read" },
  get_booking_record: { command: "get_booking_verification", riskLevel: "read" },
  get_booking_verification: { command: "get_booking_verification", riskLevel: "read" },
  search_failures: { command: "search_agent_activity", riskLevel: "read" },
  search_customers: { command: "search_customers", riskLevel: "read" },
  search_appointments: { command: "search_appointments", riskLevel: "read" },
  get_test_results: { command: "run_agent_simulation", riskLevel: "read" },
  get_pending_attention: { command: "get_attention_inbox", riskLevel: "read" },
  get_attention_items: { command: "get_attention_inbox", riskLevel: "read" },
  get_knowledge_summary: { command: "get_memory_view", riskLevel: "read" },
  get_setup_readiness: { command: "get_setup_readiness", riskLevel: "read" },
  verify_live_drift: { command: "get_deployment_drift", riskLevel: "read" },
  get_deployment_status: { command: "get_deployment_drift", riskLevel: "read" },
  get_current_version: { command: "list_versions", riskLevel: "read" },
  get_versions: { command: "list_versions", riskLevel: "read" },
  list_change_proposals: { command: "list_change_proposals", riskLevel: "read" },
  create_booking_policy_proposal: { command: "create_change_proposal", riskLevel: "low" },
  create_collection_field_proposal: { command: "propose_setup_change", riskLevel: "medium" },
  create_service_proposal: { command: "propose_setup_change", riskLevel: "medium" },
  create_transfer_rule_proposal: { command: "propose_setup_change", riskLevel: "medium" },
  create_voice_proposal: { command: "propose_setup_change", riskLevel: "low" },
  create_resource_assignment_proposal: { command: "propose_setup_change", riskLevel: "high" },
  create_knowledge_proposal: { command: "create_change_proposal", riskLevel: "low" },
  propose_setup_change: { command: "propose_setup_change", riskLevel: "medium" },
  confirm_change_proposal: {
    command: "confirm_change_proposal",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  reject_change_proposal: { command: "reject_change_proposal", riskLevel: "low" },
  request_workflow_draft: { command: "create_workflow_draft", riskLevel: "low" },
  get_workflow_draft: { command: "list_workflow_drafts", riskLevel: "read" },
  list_workflow_drafts: { command: "list_workflow_drafts", riskLevel: "read" },
  validate_workflow_draft: { command: "validate_workflow_draft", riskLevel: "read" },
  compare_workflow_draft: { command: "list_workflow_drafts", riskLevel: "read" },
  promote_workflow_draft: {
    command: "promote_workflow_draft",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  request_workflow_tests: { command: "run_agent_test_suite", riskLevel: "low" },
  run_simulation: { command: "run_agent_simulation", riskLevel: "read" },
  run_regression_suite: { command: "run_agent_test_suite", riskLevel: "read" },
  request_live_test: { command: "run_agent_test_snapshot", riskLevel: "low" },
  get_job_status: { command: "run_agent_test_snapshot", riskLevel: "read" },
  get_test_run: { command: "run_agent_test_suite", riskLevel: "read" },
  request_version_activation: {
    command: "activate_agent_version",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  confirm_version_activation: {
    command: "activate_agent_version",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  rollback_version: {
    command: "rollback_agent_version",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  request_rollback: {
    command: "rollback_agent_version",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  confirm_rollback: {
    command: "rollback_agent_version",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  duplicate_agent_draft: { command: "duplicate_agent", riskLevel: "medium", requiresConfirmation: true },
  pause_agent: { command: "pause_agent", riskLevel: "high", requiresConfirmation: true },
  resume_agent: { command: "resume_agent", riskLevel: "medium" },
  diagnose_execution: { specialist: "diagnostic_specialist", riskLevel: "read" },
  get_daily_report: { command: "get_daily_report", riskLevel: "read" },
  owner_ask: { command: "owner_ask", blocked: true },
  get_john_mctb_settings: { riskLevel: "read" },
  update_john_mctb_settings: { riskLevel: "medium" },
  search_missed_calls: { riskLevel: "read" },
  get_missed_call_details: { riskLevel: "read" },
  request_john_workflow_draft: { riskLevel: "low" },
};

const OBJECT = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

function buildAgentToolDefinitions(): AgentToolDefinition[] {
  return OWNER_AMY_TOOL_DESCRIPTIONS.filter((t) => OWNER_LLM_TOOL_SPECS[t.id]).map((t) => {
    const spec = OWNER_LLM_TOOL_SPECS[t.id];
    const sideEffect =
      t.sideEffects === "none"
        ? "none"
        : t.sideEffects === "proposal"
          ? "draft_only"
          : t.sideEffects === "queued_job"
            ? "test"
            : t.sideEffects === "production_write"
              ? "production_change"
              : "draft_only";
    return {
      id: t.id,
      name: t.id,
      purpose: t.purpose,
      useWhen: t.useWhen,
      doNotUseWhen: t.doNotUseWhen,
      inputSchema: OBJECT({}),
      outputSchema: { type: "object" },
      sideEffect,
      riskLevel:
        spec.riskLevel === "read"
          ? "read"
          : spec.riskLevel === "high"
            ? "high"
            : spec.riskLevel === "medium"
              ? "medium"
              : "low",
      requiresConfirmation: Boolean(spec.requiresConfirmation),
      possibleStatuses: ["completed", "queued", "blocked", "failed", "not_found"],
    };
  });
}

/** Parameter schemas for tools exposed to the LLM. */
const LLM_PARAMETER_OVERRIDES: Record<string, Record<string, unknown>> = {
  search_calls: OBJECT({
    limit: { type: "number", description: "Max calls (default 5)" },
    failuresOnly: { type: "boolean", description: "Only failed or unbooked calls" },
    query: {
      type: "string",
      description: "Natural-language search terms (e.g. leaking kitchen sink, caller phone fragment)",
    },
  }),
  search_agent_activity: OBJECT({
    limit: { type: "number", description: "Max calls (default 5)" },
    failuresOnly: { type: "boolean" },
    query: { type: "string", description: "Semantic search across call summaries and traces" },
  }),
  search_customers: OBJECT({
    query: { type: "string", description: "Name, phone, or email fragment" },
    limit: { type: "number" },
  }),
  search_appointments: OBJECT({
    query: { type: "string", description: "Service, customer, or notes fragment" },
    callId: { type: "string", description: "Optional call id to scope search" },
    limit: { type: "number" },
  }),
  search_failures: OBJECT({
    limit: { type: "number", description: "Max failures (default 10)" },
  }),
  get_agent_metrics: OBJECT({
    windowDays: { type: "number", description: "Days to include (default 7)" },
  }),
  get_agent_settings: OBJECT({
    section: {
      type: "string",
      enum: [
        "booking_policy",
        "collection_fields",
        "services",
        "voice",
        "routing",
        "calendar",
        "confirmation",
        "permissions",
      ],
      description: "Optional section filter",
    },
  }),
  get_call_trace: OBJECT({ callId: { type: "string" } }, ["callId"]),
  get_execution_trace: OBJECT({ callId: { type: "string" } }, ["callId"]),
  get_booking_record: OBJECT({
    callId: { type: "string" },
    appointmentId: { type: "string" },
  }),
  explain_call_failure: OBJECT({ callId: { type: "string" } }, ["callId"]),
  diagnose_execution: OBJECT({
    callId: { type: "string", description: "Call to diagnose" },
  }, ["callId"]),
  create_booking_policy_proposal: OBJECT({
    naturalLanguage: { type: "string" },
    summary: { type: "string" },
    minimumNoticeMinutes: { type: "number" },
  }),
  create_collection_field_proposal: OBJECT({
    label: { type: "string" },
    question: { type: "string" },
    type: { type: "string" },
    required: { type: "boolean" },
    confirmationRequired: { type: "boolean" },
  }),
  create_voice_proposal: OBJECT({
    openingGreeting: { type: "string" },
    voiceId: { type: "string" },
  }),
  confirm_change_proposal: OBJECT({
    proposalId: { type: "string" },
    confirmationId: { type: "string", description: "Backend confirmation record id" },
    publish: { type: "boolean" },
  }, ["proposalId", "confirmationId"]),
  request_workflow_draft: OBJECT({
    userRequest: { type: "string" },
  }, ["userRequest"]),
  validate_workflow_draft: OBJECT({ draftId: { type: "string" } }, ["draftId"]),
  promote_workflow_draft: OBJECT({
    draftId: { type: "string" },
    confirmationId: { type: "string" },
    confirm: { type: "boolean" },
  }, ["draftId", "confirmationId"]),
  verify_live_drift: OBJECT({
    fetchRemote: { type: "boolean" },
  }),
  request_version_activation: OBJECT({
    versionId: { type: "string" },
    confirmationId: { type: "string" },
  }),
  rollback_version: OBJECT({
    versionId: { type: "string" },
    confirmationId: { type: "string" },
  }, ["versionId", "confirmationId"]),
  duplicate_agent_draft: OBJECT({
    name: { type: "string" },
    confirmationId: { type: "string" },
    confirm: { type: "boolean" },
  }),
  pause_agent: OBJECT({ confirmationId: { type: "string" } }),
};

export const OWNER_AGENT_TOOL_DEFINITIONS = buildAgentToolDefinitions();

export const OWNER_LLM_TOOL_DEFINITIONS: LlmToolDefinition[] = OWNER_AGENT_TOOL_DEFINITIONS.map(
  (def) => {
    const params = LLM_PARAMETER_OVERRIDES[def.id] || def.inputSchema;
    return {
      type: "function",
      function: {
        name: def.id,
        description: `${def.purpose} Risk: ${def.riskLevel}. Confirmation required: ${def.requiresConfirmation}.`,
        parameters: params,
      },
    };
  },
);

export function normalizeOwnerToolPayload(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case "search_calls":
    case "search_agent_activity":
    case "search_failures":
      return {
        limit: args.limit ?? (toolName === "search_failures" ? 10 : 5),
        failuresOnly: args.failuresOnly ?? toolName === "search_failures",
        summariesOnly: false,
        query: args.query ? String(args.query) : undefined,
      };
    case "search_customers":
      return {
        query: args.query ? String(args.query) : undefined,
        limit: args.limit ?? 10,
      };
    case "search_appointments":
      return {
        query: args.query ? String(args.query) : undefined,
        callId: args.callId ? String(args.callId) : undefined,
        limit: args.limit ?? 10,
      };
    case "get_agent_metrics":
      return { windowDays: args.windowDays ?? 7 };
    case "create_booking_policy_proposal":
      return {
        naturalLanguage: args.naturalLanguage || args.summary,
        summary: args.summary,
        patch:
          args.minimumNoticeMinutes != null
            ? { minimumNoticeMinutes: args.minimumNoticeMinutes }
            : undefined,
      };
    case "create_collection_field_proposal": {
      const label = String(args.label || "Custom field").trim();
      const options = Array.isArray(args.options)
        ? (args.options as string[]).map(String)
        : typeof args.options === "string"
          ? args.options.split(/,|\s+or\s+/i).map((s) => s.trim()).filter(Boolean)
          : undefined;
      const type =
        args.type === "single_select" || (options && options.length >= 2)
          ? "single_select"
          : (args.type as string) || "text";
      const userRequest = options?.length
        ? `Add a required ${label} field with ${options.join(", ")}`
        : `Add a required ${label} field`;
      return {
        userRequest,
        summary: userRequest,
        route: "workflow_architect_field_candidate",
        collectionFieldHint: { label, type, options, required: args.required !== false },
      };
    }
    case "create_voice_proposal":
      return {
        summary: "Update voice/greeting",
        voice: {
          openingGreeting: args.openingGreeting,
          voiceId: args.voiceId,
        },
      };
    case "confirm_change_proposal":
      return {
        proposalId: args.proposalId,
        confirm: true,
        publish: args.publish !== false,
        confirmationId: args.confirmationId,
      };
    case "request_workflow_draft":
      return { userRequest: args.userRequest };
    case "validate_workflow_draft":
      return { draftId: args.draftId };
    case "promote_workflow_draft":
      return {
        draftId: args.draftId,
        confirm: true,
        confirmationId: args.confirmationId,
      };
    case "verify_live_drift":
    case "get_deployment_status":
      return { fetchRemote: args.fetchRemote ?? true };
    case "propose_setup_change":
      return {
        summary: args.summary,
        bookingPolicy: args.bookingPolicy,
        voice: args.voice,
        collectionField: args.collectionField,
      };
    case "request_version_activation":
    case "confirm_version_activation":
      return {
        versionId: args.versionId,
        confirm: true,
        confirmationId: args.confirmationId,
      };
    case "rollback_version":
    case "request_rollback":
    case "confirm_rollback":
      return {
        versionId: args.versionId,
        confirm: true,
        confirmationId: args.confirmationId,
      };
    case "duplicate_agent_draft":
      return {
        name: args.name,
        confirm: true,
        confirmationId: args.confirmationId,
      };
    case "pause_agent":
      return { confirmationId: args.confirmationId };
    default:
      return args;
  }
}

const CONFIRMATION_ACTION_MAP: Record<string, string> = {
  confirm_change_proposal: "confirm_change_proposal",
  promote_workflow_draft: "promote_workflow_draft",
  request_version_activation: "activate_agent_version",
  confirm_version_activation: "activate_agent_version",
  rollback_version: "rollback_agent_version",
  confirm_rollback: "rollback_agent_version",
  duplicate_agent_draft: "duplicate_agent",
  pause_agent: "pause_agent",
};

async function validateConfirmationGate(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolResult | null> {
  const actionType = CONFIRMATION_ACTION_MAP[input.toolName];
  if (!actionType) return null;

  const confirmationId = String(input.args.confirmationId || "");
  const targetId = String(
    input.args.proposalId || input.args.draftId || input.args.versionId || input.agentId,
  );

  if (!confirmationId) {
    return toolBlocked(
      "confirmation_required",
      `Create a confirmation record and obtain explicit owner approval before calling ${input.toolName}. Do not self-confirm.`,
    );
  }

  try {
    await consumeActionConfirmation({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      confirmationId,
      actionType,
      targetId,
    });
    return null;
  } catch (err) {
    return toolBlocked(
      "invalid_confirmation",
      err instanceof Error ? err.message : "Confirmation validation failed",
    );
  }
}

export async function executeOwnerLlmTool(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  traceCache?: Map<string, unknown>;
}): Promise<ToolResult> {
  const spec = OWNER_LLM_TOOL_SPECS[input.toolName];
  if (!spec) {
    return toolFailed("unknown_tool", `Unknown tool: ${input.toolName}`, false);
  }
  if (spec.blocked || isPlatformBlockedTool(input.toolName) || isPlatformBlockedTool(canonicalOwnerTool(input.toolName))) {
    return toolFailed("blocked_tool", `Tool ${input.toolName} is not callable from the owner agent loop`, false);
  }

  const ownerIntent = String(input.args.intent || input.args.ownerMessage || input.toolName || "");
  const ownerState = inferOwnerTaskFromIntent(ownerIntent);
  const guard = assertOwnerToolAllowed({
    tool: input.toolName,
    state: ownerState,
    permissions: defaultOwnerPermissions(),
    tests_passed: Boolean(input.args.testsPassed),
  });
  if (!guard.allowed) {
    return toolBlocked(guard.error_code || "tool_not_allowed", guard.user_message || "Action not allowed in current state");
  }

  if (spec.requiresConfirmation) {
    const gate = await validateConfirmationGate(input);
    if (gate) return gate;
  }

  // John MCTB tools — routed to John intelligence layer (not Amy control API)
  if (
    input.toolName === "get_john_mctb_settings" ||
    input.toolName === "update_john_mctb_settings" ||
    input.toolName === "search_missed_calls" ||
    input.toolName === "get_missed_call_details" ||
    input.toolName === "request_john_workflow_draft"
  ) {
    const { executeJohnAdminTool } = await import(
      "@/lib/agents/missed-call-text-back/intelligence/owner-tools"
    );
    const { architectMctbWorkflowFromRequest } = await import(
      "@/lib/agents/missed-call-text-back/intelligence/workflow-architect-mctb"
    );

    if (input.toolName === "request_john_workflow_draft") {
      const userRequest = String(input.args.userRequest || input.args.natural_language || "");
      const result = await architectMctbWorkflowFromRequest(userRequest);
      return toolCompleted({
        draft: result.draft,
        validation: result.validation,
        workflowArchitectInvoked: result.modelInvoked,
      });
    }

    const toolMap: Record<string, import("@/lib/agents/missed-call-text-back/intelligence/owner-tools").JohnAdminToolName> = {
      get_john_mctb_settings: "get_missed_call_text_settings",
      update_john_mctb_settings: "update_john_settings_via_llm",
      search_missed_calls: "search_missed_calls",
      get_missed_call_details: "get_missed_call_details",
    };

    const johnTool = toolMap[input.toolName];
    const naturalLanguage =
      input.toolName === "update_john_mctb_settings"
        ? String(input.args.natural_language || input.args.userRequest || input.args.request || "")
        : undefined;

    const raw = await executeJohnAdminTool({
      workspaceId: input.workspaceId,
      tool: johnTool,
      args: input.args,
      actor: input.userId,
      naturalLanguage,
      toolCallId: String(input.args.toolCallId || ""),
    });
    return toolCompleted(raw);
  }

  if (spec.specialist === "diagnostic_specialist") {
    const callId = String(input.args.callId || "");
    if (!callId) {
      return toolBlocked("missing_call_id", "callId is required for diagnose_execution");
    }
    const { runAgentControlCommand } = await import(
      "@/lib/agents/appointment-booking/control"
    );
    let traceData: unknown;
    try {
      traceData = await runAgentControlCommand({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        command: "get_execution_trace",
        payload: { callId },
      });
    } catch (err) {
      return toolFailed(
        "trace_fetch_failed",
        err instanceof Error ? err.message : String(err),
        true,
      );
    }
    const trace = (traceData as { trace?: unknown })?.trace || traceData;
    const result = diagnoseExecution({
      trace: trace as import("@/lib/agents/appointment-booking/types").AgentExecutionTrace,
    });
    return toolCompleted({
      ...result,
      specialistExecuted: true,
    });
  }

  if (!spec.command) {
    return toolFailed("no_command", `Tool ${input.toolName} has no command mapping`, false);
  }

  const { runAgentControlCommand } = await import(
    "@/lib/agents/appointment-booking/control"
  );
  let payload = normalizeOwnerToolPayload(input.toolName, input.args);
  let effectiveToolName = input.toolName;
  if (
    input.toolName === "create_collection_field_proposal" &&
    payload.route === "workflow_architect_field_candidate"
  ) {
    effectiveToolName = "request_workflow_draft";
    payload = { userRequest: payload.userRequest };
  }
  const command = OWNER_LLM_TOOL_SPECS[effectiveToolName]?.command || spec.command;

  try {
    const raw = await runAgentControlCommand({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      command,
      payload,
    });

    if (effectiveToolName === "request_workflow_draft") {
      const wrapped = wrapToolOutput(raw);
      const data =
        wrapped.status === "completed" ? (wrapped.data as Record<string, unknown>) : { raw };
      const architectResult = (data as { architectResult?: { creationMode?: string; architectInvocation?: unknown } }).architectResult;
      const llmRan =
        architectResult?.creationMode === "llm_architect" &&
        Boolean(architectResult?.architectInvocation);
      return toolCompleted({
        ...data,
        workflowArchitectInvoked: llmRan,
        creationMode: architectResult?.creationMode || "unknown",
      });
    }

    const wrapped = wrapToolOutput(raw);
    if (wrapped.status === "completed" && input.toolName.includes("proposal")) {
      const data = wrapped.data as Record<string, unknown>;
      return toolCompleted({
        ...data,
        proposalId: data.proposalId || data.id,
        requiresConfirmation: true,
        confirmationRequired: true,
      });
    }
    return wrapped;
  } catch (err) {
    return toolFailed(
      "control_api_error",
      err instanceof Error ? err.message : String(err),
      true,
    );
  }
}

export { stringifyToolResult };
