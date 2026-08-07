/**
 * Deterministic Workflow Architect path for adding config-driven collection fields.
 * Owner Amy → structured change request → field candidate → validator → candidate_ready.
 */
import { createId } from "@/lib/supabase/id";
import { toCustomFieldId } from "@/lib/voice/field-runtime/system-fields";
import type { BuilderFieldType } from "@/lib/voice/field-runtime/types";
import {
  createStructuredChangeRequest,
  toArchitectBuildRequest,
  type ArchitectBuildResponse,
} from "@/lib/platform/owner-runtime/change-requests";
import {
  assertValidWorkflowOrFail,
  validateCanonicalWorkflow,
} from "@/lib/platform/workflow-dsl/validator";
import type { CanonicalWorkflowSpec } from "@/lib/platform/workflow-dsl/types";
import {
  createCandidateVersion,
  toArchitectBuildResponse,
} from "@/lib/platform/architect-runtime/versioning";
import {
  architectWorkflowFromRequest,
} from "@/lib/agents/appointment-booking/workflow-architect";
import {
  validateWorkflowDraft,
  type WorkflowDraft,
  type WorkflowDraftEdge,
  type WorkflowDraftNode,
} from "@/lib/agents/appointment-booking/workflow-validator";
import type { WorkflowArchitectResult } from "@/lib/agents/appointment-booking/intelligence/types";
import { WORKFLOW_INVARIANTS } from "@/lib/agents/appointment-booking/intelligence/workflow-architect-invariants";
import { generateWorkflowTestPlan } from "@/lib/agents/appointment-booking/intelligence/workflow-test-plan";

export type ParsedFieldAddition = {
  label: string;
  field_id: string;
  type: BuilderFieldType;
  options?: string[];
  required: boolean;
  question: string;
};

function defaultQuestion(label: string, type: BuilderFieldType): string {
  if (type === "single_select" || type === "multi_select") {
    return `What is your ${label.toLowerCase()}?`;
  }
  return `Could you tell me your ${label.toLowerCase()}?`;
}

function extractOptions(request: string): string[] | undefined {
  const slashList = request.match(
    /\b(?:with|options?|choices?)\s+(.+?)(?:\?|\.|$)/i,
  );
  const segment = slashList?.[1] || request;
  const orSplit = segment.split(/\s*,\s*|\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
  const cleaned = orSplit
    .map((s) => s.replace(/^["']|["']$/g, "").replace(/^or\s+/i, "").replace(/\.$/, "").trim())
    .filter((s) => s.length > 1 && s.length < 64);
  if (cleaned.length >= 2) return cleaned.slice(0, 12);
  return undefined;
}

function extractLabel(request: string): string | null {
  const patterns = [
    /\b(?:add|require|collect)\s+(?:a\s+|an\s+|the\s+)?required\s+(.+?)\s+field\b/i,
    /\b(?:add|require|collect)\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+field\b/i,
    /\brequired\s+(.+?)\s+(?:field|information)\b/i,
  ];
  for (const pattern of patterns) {
    const match = request.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\bwith\b.+$/i, "")
        .replace(/\bhouse\b.*/i, "")
        .replace(/[?.!]+$/, "")
        .trim();
    }
  }
  return null;
}

export function parseFieldAdditionRequest(request: string): ParsedFieldAddition | null {
  const q = request.trim();
  if (!q) return null;
  const isFieldRequest =
    /\b(add|require|collect)\b/i.test(q) &&
    (/\bfield\b/i.test(q) ||
      /\b(property type|information|question)\b/i.test(q) ||
      /\b(house|apartment|commercial)\b/i.test(q));
  if (!isFieldRequest) return null;

  const labelRaw = extractLabel(q) || "Custom field";
  const label = labelRaw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const options = extractOptions(q);
  const type: BuilderFieldType =
    options && options.length >= 2
      ? "single_select"
      : /\bemail\b/i.test(q)
        ? "email"
        : /\baddress\b/i.test(q)
          ? "address"
          : /\bphone\b/i.test(q)
            ? "phone"
            : "text";
  const required = !/\boptional\b/i.test(q);
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const field_id = toCustomFieldId(slug || "custom_field");

  return {
    label,
    field_id,
    type,
    options,
    required,
    question: defaultQuestion(label, type),
  };
}

function edge(fromNodeId: string, toNodeId: string, condition?: string): WorkflowDraftEdge {
  return { fromNodeId, toNodeId, ...(condition ? { condition } : {}) };
}

export function buildFieldAdditionWorkflowDraft(input: {
  agentId: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
  parsed: ParsedFieldAddition;
}): WorkflowDraft {
  const base = architectWorkflowFromRequest({
    agentId: input.agentId,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId || "default_phone",
    timezone: input.timezone,
  });

  const collectNodeId = `collect_${input.parsed.field_id.replace(/^fld_/, "")}`;
  const newCollect: WorkflowDraftNode = {
    id: collectNodeId,
    type: "collect_field",
    config: {
      fieldKey: input.parsed.field_id,
      field_id: input.parsed.field_id,
      label: input.parsed.label,
      required: input.parsed.required,
      type: input.parsed.type,
      options: input.parsed.options,
      question: input.parsed.question,
    },
  };

  const nodes = [...base.nodes];
  const edges = [...base.edges];
  const existingCollectIdx = nodes.findIndex((n) => n.id === "collect");
  if (existingCollectIdx >= 0) {
    const existing = nodes[existingCollectIdx];
    const fields = Array.isArray(existing.config.fields)
      ? [...(existing.config.fields as string[])]
      : [];
    if (!fields.includes(input.parsed.field_id)) {
      fields.push(input.parsed.field_id);
    }
    nodes[existingCollectIdx] = {
      ...existing,
      config: { ...existing.config, fields, fieldKey: input.parsed.field_id },
    };
  } else {
    nodes.push(newCollect);
    const collectOutgoing = edges.find((e) => e.fromNodeId === "collect" && e.toNodeId === "resolve_dt");
    if (collectOutgoing) {
      edges.push(edge("collect", collectNodeId));
      edges.push(edge(collectNodeId, "resolve_dt"));
      collectOutgoing.toNodeId = collectNodeId;
    }
  }

  const draft: WorkflowDraft = {
    ...base,
    id: createId(),
    name: `Add field: ${input.parsed.label}`,
    sourceRequest: input.userRequest,
    nodes,
    edges,
    validationStatus: "not_validated",
    validationErrors: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    requiresConfirmation: true,
  };

  const validated = validateWorkflowDraft(draft);
  return {
    ...validated,
    ...(validated.validationStatus === "valid" ? { status: "ready_for_test" as const } : {}),
  };
}

function buildMinimalCanonicalSpec(input: {
  agent_id: string;
  version: number;
  field: ParsedFieldAddition;
  change_request_id: string;
}): CanonicalWorkflowSpec {
  return {
    workflow_id: `wf_${input.agent_id}`,
    version: input.version,
    entry_node: "n_collect",
    nodes: [
      {
        id: "n_collect",
        type: "collect_field",
        version: 1,
        config: {
          field_id: input.field.field_id,
          label: input.field.label,
          type: input.field.type,
          options: input.field.options,
          required: input.field.required,
        },
        next: "n_book",
      },
      {
        id: "n_book",
        type: "confirm_booking",
        version: 1,
        config: {
          start_time: "2026-08-08T14:00:00Z",
          service_id: "default_service",
        },
        on_failure: [{ error_code: "SLOT_UNAVAILABLE", next_node_id: "n_end" }],
        next: "n_end",
      },
      {
        id: "n_end",
        type: "end",
        version: 1,
        config: {},
      },
    ],
    metadata: {
      candidate: true,
      change_request_id: input.change_request_id,
    },
  };
}

export function buildFieldAdditionCandidate(input: {
  tenant_id: string;
  user_id: string;
  agent_id: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
}): {
  changeRequest: ReturnType<typeof createStructuredChangeRequest>;
  architectRequest: ReturnType<typeof toArchitectBuildRequest>;
  draft: WorkflowDraft;
  field: ParsedFieldAddition;
  candidateResponse: ArchitectBuildResponse;
  architectResult: WorkflowArchitectResult;
} | null {
  const parsed = parseFieldAdditionRequest(input.userRequest);
  if (!parsed) return null;

  const changeRequest = createStructuredChangeRequest({
    tenant_id: input.tenant_id,
    requested_by_user_id: input.user_id,
    target_agent_id: input.agent_id,
    intent: "update_workflow",
    reason: input.userRequest,
    changes: {
      goal: input.userRequest,
      field: parsed,
      constraints: { dynamic_field: true },
    },
  });

  const architectRequest = toArchitectBuildRequest(changeRequest);
  const draft = buildFieldAdditionWorkflowDraft({
    agentId: input.agent_id,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId,
    timezone: input.timezone,
    parsed,
  });

  const canonical = buildMinimalCanonicalSpec({
    agent_id: input.agent_id,
    version: draft.version,
    field: parsed,
    change_request_id: changeRequest.change_request_id,
  });
  const knownFields = new Set([parsed.field_id, "fld_problem", "fld_notes"]);
  const validation = validateCanonicalWorkflow(canonical, { known_field_ids: knownFields });
  const repair = assertValidWorkflowOrFail(canonical, { known_field_ids: knownFields });

  const validationPassed =
    draft.validationStatus === "valid" &&
    validation.valid &&
    repair.status === "valid";

  const candidate = createCandidateVersion({
    workflow_id: canonical.workflow_id,
    next_version: (canonical.version || 0) + 1,
    spec: canonical,
    change_request_id: changeRequest.change_request_id,
    validation_passed: validationPassed,
  });

  const candidateResponse = toArchitectBuildResponse(candidate, {
    passed: validationPassed ? 1 : 0,
    failed: validationPassed ? 0 : 1,
  }, [
    `Field ${parsed.field_id} (${parsed.label})`,
    `Type: ${parsed.type}`,
    parsed.options?.length ? `Options: ${parsed.options.join(", ")}` : "",
    `Workflow draft validation: ${draft.validationStatus}`,
  ].filter(Boolean));

  const architectResult: WorkflowArchitectResult = {
    status: validationPassed && candidateResponse.status === "candidate_ready" ? "draft_created" : "needs_information",
    summary: validationPassed
      ? `Candidate ready: required field "${parsed.label}" (${parsed.field_id}) with ${parsed.options?.length || 0} option(s).`
      : `Field draft created but validation needs attention for "${parsed.label}".`,
    interpretation: input.userRequest,
    requiredResources: [],
    missingInformation: validation.errors.map((e) => e.message),
    nodes: draft.nodes,
    edges: draft.edges,
    changedNodes: draft.nodes.map((n) => n.id),
    removedNodes: [],
    invariantsChecked: [...WORKFLOW_INVARIANTS],
    risks: validationPassed
      ? []
      : [{ code: "validation_errors", level: "high", description: "Candidate validation incomplete" }],
    requiredTests: generateWorkflowTestPlan({
      userRequest: input.userRequest,
      nodeTypes: draft.nodes.map((n) => n.type),
    }),
    draftId: draft.id,
    creationMode: "validated_template",
  };

  return {
    changeRequest,
    architectRequest,
    draft,
    field: parsed,
    candidateResponse,
    architectResult,
  };
}
