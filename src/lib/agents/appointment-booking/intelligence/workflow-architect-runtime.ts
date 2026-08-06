/**
 * Workflow Architect runtime — schema-constrained draft results.
 */

import {
  architectWorkflowFromRequest,
} from "@/lib/agents/appointment-booking/workflow-architect";
import { validateWorkflowDraft, type WorkflowDraft } from "@/lib/agents/appointment-booking/workflow-validator";
import { APPOINTMENT_WORKFLOW_BLOCKS } from "@/lib/agents/appointment-booking/workflow-blocks";
import type { WorkflowArchitectResult } from "./types";
import { compilePromptModules, WORKFLOW_ARCHITECT_DEFAULT_MODULES } from "./prompt-modules";

const WORKFLOW_INVARIANTS = [
  "block_exists",
  "block_allowed_for_appointment_agent",
  "schema_valid",
  "resource_ownership_valid",
  "no_unreachable_node",
  "every_path_ends",
  "required_fields_before_booking",
  "confirmation_before_booking",
  "hold_before_booking",
  "booking_verification_after_creation",
  "sms_after_booking_permitted",
  "fallback_for_calendar_failure",
  "fallback_for_transfer_failure",
  "no_duplicate_action_path",
  "risk_gates_present",
  "tests_assigned",
] as const;

const REQUIRED_TESTS_BY_PATTERN: Array<{ pattern: RegExp; tests: string[] }> = [
  { pattern: /after[- ]hours/i, tests: ["after_hours_inbound", "transfer_fallback"] },
  { pattern: /emergency/i, tests: ["emergency_branch", "booking_verification"] },
  { pattern: /transfer/i, tests: ["transfer_failure_fallback"] },
  { pattern: /sms|text/i, tests: ["sms_after_booking"] },
];

function detectUnsupportedRequest(request: string): string | null {
  if (/\b(javascript|python|sql|shell|code|script)\b/i.test(request)) {
    return "Arbitrary code generation is not supported — use approved workflow blocks only.";
  }
  if (/\bnew block\b/i.test(request)) {
    return "Inventing new block types is not supported.";
  }
  return null;
}

function detectMissingInformation(request: string, phoneNumberId?: string | null): string[] {
  const missing: string[] = [];
  if (!phoneNumberId && /inbound|after[- ]hours|phone/i.test(request)) {
    missing.push("assigned phone number (phoneNumberId)");
  }
  if (/transfer to (\w+)/i.test(request)) {
    const m = request.match(/transfer to (\w+)/i);
    if (m && !/marcus|on-call|staff/i.test(m[1])) {
      missing.push(`transfer destination resource for "${m[1]}"`);
    }
  }
  if (/on-call|text the/i.test(request) && !/number|phone/i.test(request)) {
    missing.push("on-call notification number or SMS resource");
  }
  return missing;
}

function assignRequiredTests(request: string): string[] {
  const tests = new Set<string>(["workflow_validation", "caller_confirmation_before_booking"]);
  for (const rule of REQUIRED_TESTS_BY_PATTERN) {
    if (rule.pattern.test(request)) {
      for (const t of rule.tests) tests.add(t);
    }
  }
  return [...tests];
}

function assessRisks(draft: WorkflowDraft): WorkflowArchitectResult["risks"] {
  const risks: WorkflowArchitectResult["risks"] = [];
  const hasTransfer = draft.nodes.some((n) => n.type.includes("transfer"));
  const hasBooking = draft.nodes.some((n) => n.type.includes("create_appointment"));
  const hasSms = draft.nodes.some((n) => n.type.includes("sms") || n.type.includes("confirmation"));

  if (hasBooking && !draft.nodes.some((n) => n.type.includes("confirm"))) {
    risks.push({
      code: "missing_confirmation",
      level: "high",
      description: "Booking path without explicit confirmation node.",
    });
  }
  if (hasTransfer) {
    risks.push({
      code: "transfer_branch",
      level: "medium",
      description: "Transfer branch present — ensure fallback if destination unavailable.",
    });
  }
  if (hasSms && !hasBooking) {
    risks.push({
      code: "sms_without_booking",
      level: "high",
      description: "SMS node without verified booking path.",
    });
  }
  if (draft.validationErrors.length) {
    risks.push({
      code: "validation_errors",
      level: "high",
      description: `${draft.validationErrors.length} validation error(s) must be resolved.`,
    });
  }
  return risks;
}

export function buildWorkflowArchitectFromRequest(input: {
  agentId: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
  currentNodeIds?: string[];
}): WorkflowArchitectResult {
  const unsupported = detectUnsupportedRequest(input.userRequest);
  if (unsupported) {
    return {
      status: "unsupported",
      summary: unsupported,
      requiredResources: [],
      missingInformation: [],
      nodes: [],
      edges: [],
      changedNodes: [],
      removedNodes: [],
      invariantsChecked: [],
      risks: [{ code: "unsupported_request", level: "high", description: unsupported }],
      requiredTests: [],
    };
  }

  const missing = detectMissingInformation(input.userRequest, input.phoneNumberId);
  if (missing.length > 0 && /sewer|on-call|transfer to/i.test(input.userRequest)) {
    return {
      status: "needs_information",
      summary: "Additional resources are required before this workflow can be drafted.",
      requiredResources: missing,
      missingInformation: missing,
      nodes: [],
      edges: [],
      changedNodes: [],
      removedNodes: [],
      invariantsChecked: WORKFLOW_INVARIANTS.slice(0, 4),
      risks: [],
      requiredTests: assignRequiredTests(input.userRequest),
    };
  }

  const draft = architectWorkflowFromRequest({
    agentId: input.agentId,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId,
    timezone: input.timezone,
  });

  const validated = validateWorkflowDraft(draft);
  const changedNodes = validated.nodes.map((n) => n.id);
  const risks = assessRisks(validated);

  return {
    status: validated.validationStatus === "valid" ? "draft_created" : "needs_information",
    summary: `Draft "${validated.name}" with ${validated.nodes.length} nodes. Validation: ${validated.validationStatus}.`,
    requiredResources: input.phoneNumberId ? [`phone:${input.phoneNumberId}`] : [],
    missingInformation: validated.validationErrors.map((e) => e.message),
    nodes: validated.nodes,
    edges: validated.edges,
    changedNodes,
    removedNodes: input.currentNodeIds?.filter((id) => !changedNodes.includes(id)) || [],
    invariantsChecked: [...WORKFLOW_INVARIANTS],
    risks,
    requiredTests: assignRequiredTests(input.userRequest),
    draftId: validated.id,
  };
}

export function buildWorkflowArchitectSystemPrompt(): string {
  const blockList = APPOINTMENT_WORKFLOW_BLOCKS.map((b) => `- ${b.type}: ${b.label}`).join("\n");
  return `${compilePromptModules({
    modules: WORKFLOW_ARCHITECT_DEFAULT_MODULES,
    context: {},
  })}

APPROVED BLOCK REGISTRY (${APPOINTMENT_WORKFLOW_BLOCKS.length} blocks):
${blockList}`;
}

export { WORKFLOW_INVARIANTS };
