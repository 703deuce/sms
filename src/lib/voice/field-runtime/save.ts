import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadWorkflowFieldDefinitions } from "./loader";
import {
  ensureWorkflowFieldSession,
  saveWorkflowFieldSession,
  setSessionField,
  syncKnownServiceToSession,
} from "./session";
import { SYSTEM_FIELD_IDS } from "./system-fields";
import { FieldValidationError, validateFieldValue } from "./validate";
import {
  appendFieldReceipt,
  ensureAgentRuntime,
  loadAgentRuntime,
  saveAgentRuntime,
} from "@/lib/voice/workflow-engine/runtime-state";
import { computeWorkflowState } from "@/lib/voice/workflow-engine/engine";
import { deriveNextAction } from "@/lib/voice/workflow-engine/next-action";
import { getWorkflowRequirements, requirementsToToolResponse } from "./requirements";
import type { WorkflowAction } from "./types";

export type SaveCollectedFieldsInput = {
  workspaceId: string;
  agentId?: string;
  /** Voice call id — same as workflow session_id unless overridden */
  callId: string;
  session_id?: string;
  fields: Array<{ field_id: string; value: unknown }>;
  active_field?: string | null;
  workflow?: WorkflowAction;
  serviceName?: string | null;
};

export async function saveCollectedFields(
  input: SaveCollectedFieldsInput,
): Promise<Record<string, unknown>> {
  const callId = input.session_id || input.callId;
  if (!callId) throw new Error("callId or session_id required");
  const workflow = input.workflow || "general";
  let session = await ensureWorkflowFieldSession({
    callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const defs = await loadWorkflowFieldDefinitions({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName || undefined,
  });
  const defById = new Map(defs.map((d) => [d.field_id, d]));

  const saved: string[] = [];
  for (const row of input.fields) {
    const fieldId = String(row.field_id || "").trim();
    if (!fieldId) continue;
    const def = defById.get(fieldId) || {
      field_id: fieldId,
      label: fieldId,
      type: "text" as const,
      required: false,
      collection_instruction: `Collect ${fieldId}`,
    };
    try {
      const value = validateFieldValue(def, row.value);
      session = setSessionField(session, fieldId, value, "tool", def.label);
      saved.push(fieldId);
    } catch (err) {
      if (err instanceof FieldValidationError) {
        return {
          ok: false,
          success: false,
          error: err.message,
          field_id: err.fieldId,
          speak: err.message,
        };
      }
      throw err;
    }
  }

  if (input.active_field) {
    session.active_field = String(input.active_field);
  }

  session.workflow = workflow;
  if (input.serviceName) session.service_name = input.serviceName;
  session = syncKnownServiceToSession(session, input.serviceName);

  await saveWorkflowFieldSession(callId, session);
  await syncSystemFieldsToContact({
    workspaceId: input.workspaceId,
    callId,
    session,
  }).catch(() => undefined);

  let requirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId,
    workflow,
    serviceName: input.serviceName,
  });

  session.active_field = requirements.missing_fields[0]?.field_id || null;
  await saveWorkflowFieldSession(callId, session);
  requirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId,
    workflow,
    serviceName: input.serviceName,
  });

  const { state } = await computeWorkflowState({
    callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const reqPayload = requirementsToToolResponse(requirements, {
    operationSucceeded: saved.length > 0,
    workflowState: state,
  });

  return {
    saved: saved.length > 0,
    session_id: session.session_id,
    saved_field_ids: saved,
    active_field: session.active_field,
    workflow_complete: requirements.complete,
    ...reqPayload,
  };
}

export type RecordCurrentFieldInput = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  value: unknown;
  workflow?: WorkflowAction;
  serviceName?: string | null;
};

/**
 * Minimal field collection — runtime knows active_field; Amy only submits value.
 */
export async function recordCurrentField(
  input: RecordCurrentFieldInput,
): Promise<Record<string, unknown>> {
  const workflow = input.workflow || "book_appointment";
  const requirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    workflow,
    serviceName: input.serviceName,
  });

  const fieldId = requirements.active_field;
  if (!fieldId) {
    const { state } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: input.serviceName,
    });
    return {
      ok: true,
      success: true,
      workflow_complete: requirements.complete,
      error_code: requirements.complete ? undefined : "NO_ACTIVE_FIELD",
      speak: requirements.complete
        ? "All required information is already collected."
        : "Call get_runtime_context to see what to collect next.",
      ...requirementsToToolResponse(requirements, {
        operationSucceeded: true,
        workflowState: state,
      }),
    };
  }

  const result = await saveCollectedFields({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    fields: [{ field_id: fieldId, value: input.value }],
    workflow,
    serviceName: input.serviceName,
  });

  if (result.error || result.error_code === "VALIDATION_FAILED") {
    return result;
  }

  const valueStr = String(input.value ?? "");
  let runtime = await ensureAgentRuntime({
    callId: input.callId,
    workflowId: workflow,
    serviceName: input.serviceName,
  });
  runtime = appendFieldReceipt(runtime, fieldId, valueStr);
  await saveAgentRuntime(input.callId, runtime);

  const updatedRequirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    workflow,
    serviceName: input.serviceName,
  });

  const { state } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const receipt = runtime.field_receipts.find((r) => r.field_id === fieldId);
  const currentField =
    updatedRequirements.fields_to_collect.find((f) => f.field_id === updatedRequirements.active_field) ||
    updatedRequirements.missing_fields[0] ||
    null;

  return {
    ...result,
    field_complete: true,
    field_id: fieldId,
    receipt,
    workflow_complete: updatedRequirements.complete,
    next_field: updatedRequirements.missing_fields[0] || null,
    active_field: updatedRequirements.active_field,
    current_field: currentField,
    speak: updatedRequirements.complete
      ? "Got it. All required information is collected."
      : updatedRequirements.missing_fields[0]?.collection_instruction ||
        updatedRequirements.speak,
    next_action: deriveNextAction({
      state,
      complete: updatedRequirements.complete,
      currentField,
      missingFields: updatedRequirements.missing_fields,
    }),
  };
}

async function syncSystemFieldsToContact(input: {
  workspaceId: string;
  callId: string;
  session: Awaited<ReturnType<typeof ensureWorkflowFieldSession>>;
}) {
  const phone = input.session.fields[SYSTEM_FIELD_IDS.phone]?.value;
  if (!phone) return;
  const prisma = getPrisma();
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeE164(String(phone));
  } catch {
    return;
  }
  const name = String(input.session.fields[SYSTEM_FIELD_IDS.name]?.value || "");
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  const email = input.session.fields[SYSTEM_FIELD_IDS.email]?.value
    ? String(input.session.fields[SYSTEM_FIELD_IDS.email].value)
    : null;

  const contact = await prisma.contact.upsert({
    where: {
      workspaceId_phone: { workspaceId: input.workspaceId, phone: normalizedPhone },
    },
    create: {
      workspaceId: input.workspaceId,
      phone: normalizedPhone,
      firstName,
      lastName,
      email,
    },
    update: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(email ? { email } : {}),
    },
  });

  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: { contactId: contact.id },
    })
    .catch(() => undefined);
}
