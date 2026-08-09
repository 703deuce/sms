import { loadServiceBookingConfig } from "@/lib/voice/calendar/booking";
import { loadVoiceAgentRuntimeConfigRecord } from "@/lib/voice/load-agent-config";
import {
  normalizeWizardCollectFields,
  type AgentCollectionField,
} from "@/lib/agents/appointment-booking/collection-fields";
import { resolveServiceRequiredFields } from "@/lib/solutions/appointment-receptionist/required-fields";
import { legacyIdToFieldDefinition, SYSTEM_FIELD_IDS } from "./system-fields";
import type {
  RuntimeFieldManifestEntry,
  WorkflowAction,
  WorkflowFieldDefinition,
} from "./types";

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

function parseBuilderFields(raw: unknown): WorkflowFieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowFieldDefinition[] = [];
  for (const row of raw) {
    const r = asRecord(row);
    const field_id = String(r.field_id || r.id || "").trim();
    if (!field_id) continue;
    out.push({
      field_id,
      label: String(r.label || field_id),
      type: (String(r.type || "text") as WorkflowFieldDefinition["type"]),
      required: r.required !== false,
      collection_instruction: String(
        r.collection_instruction || r.question || r.instruction || `Ask for ${r.label || field_id}.`,
      ),
      kind: field_id.startsWith("sys_") ? "system" : "custom",
      system_key: r.system_key ? String(r.system_key) : undefined,
      options: Array.isArray(r.options) ? r.options.map(String) : undefined,
      enabled: r.enabled !== false,
      ask_order: typeof r.ask_order === "number" ? r.ask_order : undefined,
    });
  }
  return out;
}

function fromCollectFields(fields: AgentCollectionField[]): WorkflowFieldDefinition[] {
  return fields
    .filter((f) => f.enabled !== false)
    .map((f) =>
      legacyIdToFieldDefinition({
        id: String(f.id || (f as { field_id?: string }).field_id || "").trim(),
        label: f.label,
        type: f.type,
        required: f.required,
        enabled: f.enabled,
        question: f.question,
        options: f.options,
        askOrder: f.askOrder,
      }),
    )
    .filter((d) => d.field_id);
}

function applyRequiredModes(
  defs: WorkflowFieldDefinition[],
  requiredIds: Set<string>,
): WorkflowFieldDefinition[] {
  return defs.map((d) => ({
    ...d,
    required: requiredIds.has(d.field_id) || requiredIds.has(d.system_key || "") || d.required,
  }));
}

function dedupeByFieldId(defs: WorkflowFieldDefinition[]): WorkflowFieldDefinition[] {
  const byId = new Map<string, WorkflowFieldDefinition>();
  for (const d of defs) {
    const prev = byId.get(d.field_id);
    if (!prev || (d.required && !prev.required)) byId.set(d.field_id, d);
  }
  return Array.from(byId.values()).sort(
    (a, b) => (a.ask_order ?? 99) - (b.ask_order ?? 99),
  );
}

const WORKFLOW_DEFAULT_SYSTEM_REQUIRED: Record<WorkflowAction, string[]> = {
  general: [SYSTEM_FIELD_IDS.name, SYSTEM_FIELD_IDS.phone],
  book_appointment: [SYSTEM_FIELD_IDS.name, SYSTEM_FIELD_IDS.phone],
  request_quote: [SYSTEM_FIELD_IDS.name, SYSTEM_FIELD_IDS.phone, SYSTEM_FIELD_IDS.address],
  leave_message: [SYSTEM_FIELD_IDS.name, SYSTEM_FIELD_IDS.phone, SYSTEM_FIELD_IDS.message],
  emergency_service: [
    SYSTEM_FIELD_IDS.name,
    SYSTEM_FIELD_IDS.phone,
    SYSTEM_FIELD_IDS.address,
  ],
};

const SYSTEM_FIELD_LABELS: Record<string, { label: string; type: WorkflowFieldDefinition["type"] }> =
  {
    [SYSTEM_FIELD_IDS.name]: { label: "Name", type: "text" },
    [SYSTEM_FIELD_IDS.phone]: { label: "Phone", type: "phone" },
    [SYSTEM_FIELD_IDS.email]: { label: "Email", type: "email" },
    [SYSTEM_FIELD_IDS.address]: { label: "Address", type: "address" },
    [SYSTEM_FIELD_IDS.service]: { label: "Service", type: "text" },
    [SYSTEM_FIELD_IDS.message]: { label: "Message", type: "long_text" },
  };

/** Booking always needs core identity fields; Calendly additionally requires email up front. */
export function bookingSystemFieldIds(calendlyConnected: boolean): string[] {
  const ids = [...WORKFLOW_DEFAULT_SYSTEM_REQUIRED.book_appointment];
  if (calendlyConnected && !ids.includes(SYSTEM_FIELD_IDS.email)) {
    ids.push(SYSTEM_FIELD_IDS.email);
  }
  return ids;
}

function ensureSystemFieldDefs(
  defs: WorkflowFieldDefinition[],
  requiredIds: string[],
): WorkflowFieldDefinition[] {
  const byId = new Map(defs.map((d) => [d.field_id, d]));
  for (const field_id of requiredIds) {
    const meta = SYSTEM_FIELD_LABELS[field_id];
    const existing = byId.get(field_id);
    if (existing) {
      byId.set(field_id, { ...existing, required: true });
      continue;
    }
    byId.set(field_id, {
      field_id,
      label: meta?.label || field_id,
      type: meta?.type || "text",
      required: true,
      collection_instruction: `Ask for ${(meta?.label || field_id).toLowerCase()}.`,
      kind: "system",
      system_key: field_id.replace("sys_", ""),
      enabled: true,
      ask_order:
        field_id === SYSTEM_FIELD_IDS.name
          ? 10
          : field_id === SYSTEM_FIELD_IDS.email
            ? 20
            : field_id === SYSTEM_FIELD_IDS.phone
              ? 30
              : 50,
    });
  }
  return dedupeByFieldId(Array.from(byId.values()));
}

/** Service/problem context first, then identity fields needed for booking. */
function orderBookingCollectionFields(
  defs: WorkflowFieldDefinition[],
): WorkflowFieldDefinition[] {
  const rank = (field: WorkflowFieldDefinition): number => {
    if (field.field_id.startsWith("fld_") || field.kind === "custom") {
      return field.ask_order ?? 1;
    }
    if (field.field_id === SYSTEM_FIELD_IDS.service) return 2;
    if (field.field_id === SYSTEM_FIELD_IDS.name) return 10;
    if (field.field_id === SYSTEM_FIELD_IDS.email) return 20;
    if (field.field_id === SYSTEM_FIELD_IDS.phone) return 30;
    return field.ask_order ?? 50;
  };
  return [...defs].sort((a, b) => rank(a) - rank(b));
}

export async function loadWorkflowFieldDefinitions(input: {
  workspaceId: string;
  agentId?: string;
  workflow: WorkflowAction;
  serviceName?: string;
}): Promise<WorkflowFieldDefinition[]> {
  let bookingCfg: Record<string, unknown> = {};
  if (input.agentId) {
    const agentCfg = await loadVoiceAgentRuntimeConfigRecord(
      input.workspaceId,
      input.agentId,
    );
    bookingCfg = bookingSectionFromAgentConfig(agentCfg);
  }

  const explicit = parseBuilderFields(bookingCfg.fields);
  if (explicit.length) {
    const wfOverride = asRecord(
      asRecord(bookingCfg.fieldRequirementsByWorkflow)[input.workflow],
    );
    if (Array.isArray(wfOverride.fields)) {
      return dedupeByFieldId(parseBuilderFields(wfOverride.fields));
    }
    return dedupeByFieldId(explicit);
  }

  const collectList = Array.isArray(bookingCfg.collectFieldsList)
    ? bookingCfg.collectFieldsList
    : Array.isArray(bookingCfg.collectFields)
      ? bookingCfg.collectFields
      : [];
  let defs = fromCollectFields(
    normalizeWizardCollectFields(
      collectList as Parameters<typeof normalizeWizardCollectFields>[0],
    ),
  );

  const requiredIds = new Set<string>(WORKFLOW_DEFAULT_SYSTEM_REQUIRED[input.workflow] || []);

  if (input.workflow === "book_appointment" && input.serviceName) {
    const gates = await loadServiceBookingConfig(input.workspaceId, input.serviceName);
    const svcRequired = Array.isArray(gates.config.requiredFields)
      ? gates.config.requiredFields.map(String)
      : [];
    const resolved = resolveServiceRequiredFields(
      svcRequired,
      collectList as Array<{ id: string; enabled?: boolean }>,
    );
    for (const legacyId of resolved) {
      const mapped = legacyIdToFieldDefinition({
        id: legacyId,
        label: legacyId,
        required: true,
        enabled: true,
      });
      requiredIds.add(mapped.field_id);
    }
  }

  defs = applyRequiredModes(defs, requiredIds);

  if (!defs.length) {
    const labels: Record<string, string> = {
      [SYSTEM_FIELD_IDS.name]: "Name",
      [SYSTEM_FIELD_IDS.phone]: "Phone",
      [SYSTEM_FIELD_IDS.email]: "Email",
      [SYSTEM_FIELD_IDS.address]: "Address",
      [SYSTEM_FIELD_IDS.service]: "Service",
      [SYSTEM_FIELD_IDS.message]: "Message",
    };
    defs = (WORKFLOW_DEFAULT_SYSTEM_REQUIRED[input.workflow] || []).map((field_id) => ({
      field_id,
      label: labels[field_id] || field_id,
      type: field_id === SYSTEM_FIELD_IDS.phone ? "phone" : field_id === SYSTEM_FIELD_IDS.email ? "email" : "text",
      required: true,
      collection_instruction: `Ask for ${labels[field_id] || field_id}.`,
      kind: "system" as const,
      system_key: field_id.replace("sys_", ""),
      enabled: true,
    }));
  }

  defs = dedupeByFieldId(defs.filter((d) => d.enabled !== false));

  if (input.workflow === "book_appointment") {
    const { getConnectedCalendly } = await import("@/lib/voice/calendar/calendly-voice");
    const calendlyConnected = Boolean(await getConnectedCalendly(input.workspaceId));
    defs = ensureSystemFieldDefs(defs, bookingSystemFieldIds(calendlyConnected));
    defs = orderBookingCollectionFields(defs);
  }

  return defs;
}

export function toManifestEntries(
  defs: WorkflowFieldDefinition[],
): RuntimeFieldManifestEntry[] {
  return defs.map((d) => ({
    field_id: d.field_id,
    label: d.label,
    type: d.type,
    required: d.required,
    collection_instruction: d.collection_instruction,
    options: d.options,
  }));
}
