import { loadWorkflowFieldDefinitions, toManifestEntries } from "./loader";
import {
  ensureWorkflowFieldSession,
  getSessionFieldValue,
} from "./session";
import type { WorkflowFieldSession } from "./types";
import type {
  RuntimeFieldManifest,
  RuntimeFieldManifestEntry,
  WorkflowAction,
  WorkflowRequirementsResult,
} from "./types";

function missingFields(
  defs: RuntimeFieldManifestEntry[],
  session: WorkflowFieldSession,
): RuntimeFieldManifestEntry[] {
  return defs.filter((d) => {
    if (!d.required) return false;
    const val = getSessionFieldValue(session, d.field_id);
    return !val;
  });
}

function buildSpeak(missing: RuntimeFieldManifestEntry[]): string | null {
  if (!missing.length) return null;
  const first = missing[0];
  return first.collection_instruction || `I still need ${first.label.toLowerCase()}.`;
}

export async function buildRuntimeFieldManifest(input: {
  workspaceId: string;
  agentId?: string;
  callId: string;
  workflow: WorkflowAction;
  serviceName?: string | null;
}): Promise<RuntimeFieldManifest> {
  const session = await ensureWorkflowFieldSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });
  const defs = await loadWorkflowFieldDefinitions({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName || undefined,
  });
  return {
    workflow: input.workflow,
    service_name: input.serviceName,
    session_id: session.session_id,
    fields_to_collect: toManifestEntries(defs),
  };
}

export async function getWorkflowRequirements(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  workflow: WorkflowAction;
  serviceName?: string | null;
}): Promise<WorkflowRequirementsResult> {
  const session = input.callId
    ? await ensureWorkflowFieldSession({
        callId: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        workflow: input.workflow,
        serviceName: input.serviceName,
      })
    : null;

  const defs = await loadWorkflowFieldDefinitions({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName || undefined,
  });
  const entries = toManifestEntries(defs);
  const missing = session ? missingFields(entries, session) : entries.filter((e) => e.required);
  const collected = session
    ? entries.filter((e) => Boolean(getSessionFieldValue(session, e.field_id))).map((e) => e.field_id)
    : [];

  return {
    workflow: input.workflow,
    session_id: session?.session_id || input.callId || "no_session",
    complete: missing.length === 0,
    missing_fields: missing,
    collected_field_ids: collected,
    active_field: session?.active_field || missing[0]?.field_id || null,
    fields_to_collect: entries,
    speak: buildSpeak(missing),
  };
}

export function requirementsToToolResponse(
  result: WorkflowRequirementsResult,
): Record<string, unknown> {
  return {
    ok: result.complete,
    success: result.complete,
    complete: result.complete,
    workflow: result.workflow,
    session_id: result.session_id,
    missing_fields: result.missing_fields,
    collected_field_ids: result.collected_field_ids,
    active_field: result.active_field,
    fields_to_collect: result.fields_to_collect,
    speak: result.speak,
    message: result.complete
      ? "All required fields are collected."
      : result.speak || "Some required fields are still missing.",
    next_action: result.complete
      ? null
      : `Call save_collected_fields with fields:[{field_id:"${result.missing_fields[0]?.field_id}", value:"<caller answer>"}]`,
  };
}

export async function assertWorkflowFieldsComplete(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  workflow: WorkflowAction;
  serviceName?: string | null;
}): Promise<WorkflowRequirementsResult> {
  const result = await getWorkflowRequirements(input);
  if (!result.complete) {
    const err = new Error(
      `Missing required fields: ${result.missing_fields.map((f) => f.field_id).join(", ")}`,
    );
    (err as Error & { requirements: WorkflowRequirementsResult }).requirements = result;
    throw err;
  }
  return result;
}
