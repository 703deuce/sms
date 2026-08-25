/**
 * Workflow Architect runtime — LLM primary, validated template fallback.
 */

import {
  architectWorkflowFromRequest,
  buildAfterHoursEmergencyTransferDraft,
  buildUnsuccessfulBookingFollowupDraft,
  getTemplateRecipeType,
  isExactTemplateRecipe,
} from "@/lib/agents/appointment-booking/workflow-architect";
import { validateWorkflowDraft, type WorkflowDraft } from "@/lib/agents/appointment-booking/workflow-validator";
import { APPOINTMENT_WORKFLOW_BLOCKS } from "@/lib/agents/appointment-booking/workflow-blocks";
import type { WorkflowArchitectResult } from "./types";
import { compilePromptModules, WORKFLOW_ARCHITECT_DEFAULT_MODULES } from "./prompt-modules";
import {
  runWorkflowArchitectLlmLoop,
  hasWorkflowArchitectLlmConfigured,
} from "./workflow-architect-llm-loop";
import {
  validateWorkflowSemantics,
  semanticErrorsBlockDraft,
} from "./workflow-semantic-validator";
import { generateWorkflowTestPlan } from "./workflow-test-plan";
import { graphDiff } from "./workflow-patch";
import { WORKFLOW_INVARIANTS } from "./workflow-architect-invariants";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { getRuntimeModelConfig } from "./owner-model-config";

export { WORKFLOW_INVARIANTS };

function detectUnsupportedRequest(request: string): string | null {
  if (/\b(javascript|python|sql|shell|code|script)\b/i.test(request)) {
    return "Arbitrary code generation is not supported — use approved workflow blocks only.";
  }
  if (/\bnew block\b/i.test(request)) {
    return "Inventing new block types is not supported.";
  }
  if (/\banother website\b/i.test(request)) {
    return "External website checks are not supported in workflow blocks.";
  }
  return null;
}

function assessRisks(draft: WorkflowDraft): WorkflowArchitectResult["risks"] {
  const risks: WorkflowArchitectResult["risks"] = [];
  const hasTransfer = draft.nodes.some((n) => n.type.includes("transfer"));
  const hasBooking = draft.nodes.some((n) => n.type.includes("create_appointment"));
  const hasSms =
    draft.nodes.some((n) => n.type.includes("sms") || n.type.includes("booking_link"));

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
  if (hasSms && !hasBooking && !draft.nodes.some((n) => n.type === "send_booking_link")) {
    risks.push({
      code: "sms_without_booking",
      level: "high",
      description: "SMS node without verified booking or booking-link policy path.",
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

function resultFromTemplateDraft(input: {
  draft: WorkflowDraft;
  userRequest: string;
  phoneNumberId?: string | null;
  baseDraft?: WorkflowDraft;
}): WorkflowArchitectResult {
  const diff = graphDiff(
    input.baseDraft ||
      architectWorkflowFromRequest({
        agentId: input.draft.agentId,
        userRequest: input.userRequest,
        phoneNumberId: input.phoneNumberId,
      }),
    input.draft,
  );
  return {
    status: input.draft.validationStatus === "valid" ? "draft_created" : "needs_information",
    summary: `Draft "${input.draft.name}" via validated template. Validation: ${input.draft.validationStatus}.`,
    interpretation: input.userRequest,
    requiredResources: input.phoneNumberId ? [`phone:${input.phoneNumberId}`] : [],
    missingInformation: input.draft.validationErrors.map((e) => e.message),
    nodes: input.draft.nodes,
    edges: input.draft.edges,
    changedNodes: diff.addedNodeIds.concat(diff.updatedNodeIds),
    removedNodes: diff.removedNodeIds,
    addedNodeIds: diff.addedNodeIds,
    updatedNodeIds: diff.updatedNodeIds,
    unchangedNodeIds: diff.unchangedNodeIds,
    invariantsChecked: [...WORKFLOW_INVARIANTS],
    risks: assessRisks(input.draft),
    requiredTests: generateWorkflowTestPlan({
      userRequest: input.userRequest,
      nodeTypes: input.draft.nodes.map((n) => n.type),
    }),
    draftId: input.draft.id,
    creationMode: "validated_template",
  };
}

/** Synchronous template path — exact known recipes only. */
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
      interpretation: input.userRequest,
      requiredResources: [],
      missingInformation: [],
      nodes: [],
      edges: [],
      changedNodes: [],
      removedNodes: [],
      invariantsChecked: [],
      risks: [{ code: "unsupported_request", level: "high", description: unsupported }],
      requiredTests: [],
      creationMode: "validated_template",
    };
  }

  if (!isExactTemplateRecipe(input.userRequest)) {
    return {
      status: "needs_information",
      summary:
        "Workflow drafting requires the LLM Architect for this request. Configure WORKFLOW_ARCHITECT_PROVIDER or use an exact template phrase.",
      interpretation: input.userRequest,
      requiredResources: [],
      missingInformation: ["LLM Workflow Architect not available for arbitrary natural language"],
      nodes: [],
      edges: [],
      changedNodes: [],
      removedNodes: [],
      invariantsChecked: [],
      risks: [],
      requiredTests: [],
      creationMode: "validated_template",
    };
  }

  let draft: WorkflowDraft;
  const recipe = getTemplateRecipeType(input.userRequest);
  if (recipe === "emergency_transfer") {
    draft = buildAfterHoursEmergencyTransferDraft({
      agentId: input.agentId,
      userRequest: input.userRequest,
      phoneNumberId: input.phoneNumberId,
      timezone: input.timezone,
    });
  } else if (recipe === "followup_sms") {
    draft = buildUnsuccessfulBookingFollowupDraft({
      agentId: input.agentId,
      userRequest: input.userRequest,
      phoneNumberId: input.phoneNumberId,
    });
  } else {
    draft = architectWorkflowFromRequest({
      agentId: input.agentId,
      userRequest: input.userRequest,
      phoneNumberId: input.phoneNumberId,
      timezone: input.timezone,
    });
  }

  const semantic = validateWorkflowSemantics(draft);
  if (semanticErrorsBlockDraft(semantic)) {
    draft = {
      ...draft,
      validationStatus: "invalid",
      validationErrors: [
        ...draft.validationErrors,
        ...semantic
          .filter((e) => e.level === "error")
          .map((e) => ({ nodeId: e.nodeId, code: e.code, message: e.message })),
      ],
    };
  }

  return resultFromTemplateDraft({
    draft,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId,
  });
}

/** Primary async entry — LLM Architect with template fallback. */
export async function runWorkflowArchitect(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  userRequest: string;
  agent: AppointmentBookingAgentView;
  draftConfig?: unknown;
  phoneNumberId?: string | null;
  timezone?: string;
}): Promise<{ result: WorkflowArchitectResult; draft?: WorkflowDraft }> {
  const { buildFieldAdditionCandidate } = await import(
    "@/lib/platform/architect-runtime/field-candidate"
  );
  const fieldCandidate = buildFieldAdditionCandidate({
    tenant_id: input.workspaceId,
    user_id: input.userId,
    agent_id: input.agentId,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId,
    timezone: input.timezone,
  });
  if (fieldCandidate) {
    return {
      result: {
        ...fieldCandidate.architectResult,
        graphDiff: undefined,
      },
      draft: fieldCandidate.draft,
    };
  }

  const unsupported = detectUnsupportedRequest(input.userRequest);
  if (unsupported) {
    return {
      result: {
        status: "unsupported",
        summary: unsupported,
        interpretation: input.userRequest,
        requiredResources: [],
        missingInformation: [],
        nodes: [],
        edges: [],
        changedNodes: [],
        removedNodes: [],
        invariantsChecked: [],
        risks: [{ code: "unsupported_request", level: "high", description: unsupported }],
        requiredTests: [],
      },
    };
  }

  if (hasWorkflowArchitectLlmConfigured()) {
    try {
      const { result, draft } = await runWorkflowArchitectLlmLoop({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        userRequest: input.userRequest,
        agent: input.agent,
        draftConfig: input.draftConfig,
        phoneNumberId: input.phoneNumberId,
        timezone: input.timezone,
      });
      if (draft) return { result, draft };
      if (result.status !== "needs_information" || result.architectInvocation) {
        return { result };
      }
    } catch (err) {
      console.warn(
        "[workflow-architect] LLM failed, falling back to template",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (isExactTemplateRecipe(input.userRequest)) {
    let draft: WorkflowDraft;
    const recipe = getTemplateRecipeType(input.userRequest);
    if (recipe === "emergency_transfer") {
      draft = buildAfterHoursEmergencyTransferDraft({
        agentId: input.agentId,
        userRequest: input.userRequest,
        phoneNumberId: input.phoneNumberId,
        timezone: input.timezone,
      });
    } else if (recipe === "followup_sms") {
      draft = buildUnsuccessfulBookingFollowupDraft({
        agentId: input.agentId,
        userRequest: input.userRequest,
        phoneNumberId: input.phoneNumberId,
      });
    } else {
      draft = architectWorkflowFromRequest({
        agentId: input.agentId,
        userRequest: input.userRequest,
        phoneNumberId: input.phoneNumberId,
        timezone: input.timezone,
      });
    }
    return {
      result: resultFromTemplateDraft({
        draft,
        userRequest: input.userRequest,
        phoneNumberId: input.phoneNumberId,
      }),
      draft,
    };
  }

  return {
    result: {
      status: "needs_information",
      summary:
        "Workflow drafting is temporarily unavailable for this request. The LLM Workflow Architect is not configured and this request does not match a validated template recipe.",
      interpretation: input.userRequest,
      requiredResources: [],
      missingInformation: ["Configure WORKFLOW_ARCHITECT_PROVIDER and WORKFLOW_ARCHITECT_MODEL"],
      nodes: [],
      edges: [],
      changedNodes: [],
      removedNodes: [],
      invariantsChecked: [],
      risks: [],
      requiredTests: [],
      creationMode: "validated_template",
    },
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

export function getWorkflowArchitectRuntimeMode():
  | { mode: "llm_architect"; provider: string; model: string }
  | { mode: "template_fallback"; reason: string } {
  if (hasWorkflowArchitectLlmConfigured()) {
    const cfg = getRuntimeModelConfig("workflow_architect");
    return { mode: "llm_architect", provider: cfg.provider, model: cfg.model };
  }
  return {
    mode: "template_fallback",
    reason: "No LLM provider configured — exact template recipes only",
  };
}
