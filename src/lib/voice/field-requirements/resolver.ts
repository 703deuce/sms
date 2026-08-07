import { loadServiceBookingConfig } from "@/lib/voice/calendar/booking";
import { loadVoiceAgentRuntimeConfigRecord } from "@/lib/voice/load-agent-config";
import {
  normalizeWizardCollectFields,
  type AgentCollectionField,
} from "@/lib/agents/appointment-booking/collection-fields";
import { resolveServiceRequiredFields } from "@/lib/solutions/appointment-receptionist/required-fields";
import {
  catalogField,
  STANDARD_FIELD_CATALOG,
  WORKFLOW_DEFAULT_REQUIRED,
} from "./definitions";
import { canonicalFieldId } from "./field-hints";
import type { FieldCollectionMode, FieldRequirement, WorkflowAction } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bookingSectionFromAgentConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const flow = asRecord(config.conversationFlow);
  const sections = Array.isArray(flow.sections) ? flow.sections : [];
  const booking = sections.find((s) => {
    const row = asRecord(s);
    return row.type === "booking" || row.id === "booking";
  });
  return asRecord(asRecord(booking).config);
}

function collectFieldsListFromConfig(
  bookingCfg: Record<string, unknown>,
): AgentCollectionField[] {
  const list = Array.isArray(bookingCfg.collectFieldsList)
    ? bookingCfg.collectFieldsList
    : Array.isArray(bookingCfg.collectFields)
      ? bookingCfg.collectFields
      : [];
  return normalizeWizardCollectFields(
    list as Parameters<typeof normalizeWizardCollectFields>[0],
  );
}

function mapCollectionFieldType(
  type: string,
): FieldRequirement["type"] {
  if (type === "phone" || type === "email" || type === "address" || type === "number" || type === "boolean") {
    return type;
  }
  return "text";
}

function modeForField(
  fieldId: string,
  requiredSet: Set<string>,
  field?: AgentCollectionField,
): FieldCollectionMode {
  if (field && field.enabled === false) return "dont_ask";
  if (requiredSet.has(fieldId)) return "required";
  if (field?.required) return "required";
  if (field?.enabled) return "preferred";
  return "dont_ask";
}

function requirementsFromCollectionFields(
  fields: AgentCollectionField[],
  requiredSet: Set<string>,
): FieldRequirement[] {
  const reqs: FieldRequirement[] = [];
  for (const field of fields) {
    if (!field.enabled) continue;
    const fieldId = canonicalFieldId(field.id);
    const mode = modeForField(field.id, requiredSet, field);
    if (mode === "dont_ask") continue;
    const catalog = STANDARD_FIELD_CATALOG[fieldId] || STANDARD_FIELD_CATALOG[field.id];
    reqs.push(
      catalogField(fieldId, mode, {
        label: field.label,
        ask_prompt: field.question || catalog?.ask_prompt,
        type: mapCollectionFieldType(field.type),
        aliases: catalog
          ? [...catalog.aliases, field.key, field.id]
          : [field.key, fieldId, field.id],
        custom: !catalog,
      }),
    );
  }
  return reqs;
}

function requirementsFromIdList(
  ids: string[],
  collectFields: AgentCollectionField[],
): FieldRequirement[] {
  const byId = new Map(collectFields.map((f) => [f.id, f]));
  const reqs: FieldRequirement[] = [];
  for (const rawId of ids) {
    const fieldId = canonicalFieldId(rawId);
    const field = byId.get(rawId) || byId.get(fieldId);
    if (field && field.enabled === false) continue;
    const catalog = STANDARD_FIELD_CATALOG[fieldId] || STANDARD_FIELD_CATALOG[rawId];
    reqs.push(
      catalogField(fieldId, "required", {
        label: field?.label || catalog?.label,
        ask_prompt: field?.question || catalog?.ask_prompt,
        aliases: catalog
          ? [...catalog.aliases, field?.key, rawId].filter(Boolean) as string[]
          : [field?.key || fieldId, rawId],
      }),
    );
  }
  return dedupeRequirements(reqs);
}

function dedupeRequirements(reqs: FieldRequirement[]): FieldRequirement[] {
  const byId = new Map<string, FieldRequirement>();
  for (const req of reqs) {
    const prev = byId.get(req.field_id);
    if (!prev || rankMode(req.mode) > rankMode(prev.mode)) {
      byId.set(req.field_id, req);
    }
  }
  return Array.from(byId.values()).filter((r) => r.mode !== "dont_ask");
}

function rankMode(mode: FieldCollectionMode): number {
  switch (mode) {
    case "required":
      return 4;
    case "preferred":
      return 3;
    case "optional":
      return 2;
    default:
      return 0;
  }
}

export async function resolveWorkflowFieldRequirements(input: {
  workspaceId: string;
  agentId?: string;
  workflow: WorkflowAction;
  serviceName?: string;
}): Promise<FieldRequirement[]> {
  let collectFields: AgentCollectionField[] = [];
  let workflowOverrides: Record<string, unknown> = {};

  if (input.agentId) {
    const agentCfg = await loadVoiceAgentRuntimeConfigRecord(
      input.workspaceId,
      input.agentId,
    );
    const bookingCfg = bookingSectionFromAgentConfig(agentCfg);
    collectFields = collectFieldsListFromConfig(bookingCfg);
    workflowOverrides = asRecord(
      asRecord(bookingCfg.fieldRequirementsByWorkflow)[input.workflow],
    );
  }

  if (Object.keys(workflowOverrides).length) {
    const required = Array.isArray(workflowOverrides.required_fields)
      ? workflowOverrides.required_fields.map(String)
      : [];
    const optional = Array.isArray(workflowOverrides.optional_fields)
      ? workflowOverrides.optional_fields.map(String)
      : [];
    const preferred = Array.isArray(workflowOverrides.preferred_fields)
      ? workflowOverrides.preferred_fields.map(String)
      : [];
    const reqs: FieldRequirement[] = [];
    for (const id of required) {
      reqs.push(catalogField(id, "required"));
    }
    for (const id of preferred) {
      reqs.push(catalogField(id, "preferred"));
    }
    for (const id of optional) {
      reqs.push(catalogField(id, "optional"));
    }
    const custom = Array.isArray(workflowOverrides.custom_fields)
      ? workflowOverrides.custom_fields
      : [];
    for (const row of custom) {
      const c = asRecord(row);
      const fieldId = String(c.field_id || c.key || "");
      if (!fieldId) continue;
      reqs.push(
        catalogField(fieldId, c.mode === "preferred" ? "preferred" : c.required ? "required" : "optional", {
          label: String(c.label || fieldId),
          type: (c.type as FieldRequirement["type"]) || "text",
          ask_prompt: c.ask_prompt ? String(c.ask_prompt) : undefined,
          aliases: [fieldId, String(c.key || fieldId)],
          custom: true,
        }),
      );
    }
    return dedupeRequirements(reqs);
  }

  if (input.workflow === "book_appointment" && input.serviceName) {
    const gates = await loadServiceBookingConfig(input.workspaceId, input.serviceName);
    const svcRequired = Array.isArray(gates.config.requiredFields)
      ? gates.config.requiredFields.map(String)
      : [];
    const resolved = resolveServiceRequiredFields(
      svcRequired,
      collectFields.map((f) => ({ id: f.id, enabled: f.enabled })),
    );
    if (resolved.length) {
      return requirementsFromIdList(resolved, collectFields);
    }
  }

  const defaultIds = WORKFLOW_DEFAULT_REQUIRED[input.workflow] || [];
  if (collectFields.length) {
    return dedupeRequirements(
      requirementsFromCollectionFields(
        collectFields,
        new Set(defaultIds),
      ),
    );
  }

  return defaultIds.map((id) => catalogField(id, "required"));
}
