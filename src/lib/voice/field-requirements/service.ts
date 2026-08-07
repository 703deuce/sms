import type { FieldRequirement, CustomerCompletenessResult, WorkflowAction } from "./types";
import type { CustomerCollectedState } from "./types";
import {
  flattenCollectedForBookingArgs,
  loadCustomerCollectedState,
  seedCollectedStateFromCall,
} from "./collected-state";
import { resolveWorkflowFieldRequirements } from "./resolver";

function valueFromAliases(
  field: FieldRequirement,
  sources: Record<string, unknown>[],
): string | null {
  for (const source of sources) {
    for (const alias of field.aliases) {
      const val = source[alias];
      if (val != null && String(val).trim() !== "") return String(val).trim();
    }
  }
  return null;
}

function collectedValue(
  field: FieldRequirement,
  state: CustomerCollectedState,
): string | null {
  const std = state.fields[field.field_id]?.value;
  if (std != null && String(std).trim() !== "") return String(std).trim();
  const custom = state.custom_fields[field.field_id]?.value;
  if (custom != null && String(custom).trim() !== "") return String(custom).trim();
  for (const alias of field.aliases) {
    const entry = state.fields[alias] || state.custom_fields[alias];
    if (entry?.value != null && String(entry.value).trim() !== "") {
      return String(entry.value).trim();
    }
  }
  return null;
}

export function evaluateCustomerCompleteness(input: {
  requirements: FieldRequirement[];
  state: CustomerCollectedState;
  incomingArgs?: Record<string, unknown>;
  workflow: WorkflowAction;
}): CustomerCompletenessResult {
  const argSources = [input.incomingArgs || {}, flattenCollectedForBookingArgs(input.state)];
  const missingRequired: string[] = [];
  const missingPreferred: string[] = [];
  const satisfied: string[] = [];
  const collected: CustomerCompletenessResult["collected"] = {};

  for (const field of input.requirements) {
    if (field.mode === "dont_ask" || field.mode === "optional") continue;
    const fromState = collectedValue(field, input.state);
    const fromArgs = valueFromAliases(field, argSources);
    const value = fromState || fromArgs;
    if (value) {
      satisfied.push(field.field_id);
      collected[field.field_id] = {
        value,
        source: fromState ? input.state.fields[field.field_id]?.source || "tool" : "tool",
        updated_at: new Date().toISOString(),
      };
      continue;
    }
    if (field.mode === "required") missingRequired.push(field.field_id);
    if (field.mode === "preferred") missingPreferred.push(field.field_id);
    collected[field.field_id] = null;
  }

  const complete = missingRequired.length === 0;
  const speak = !complete
    ? buildMissingFieldsSpeak(input.requirements, missingRequired)
    : null;

  return {
    complete,
    workflow: input.workflow,
    missing_required_fields: missingRequired,
    missing_preferred_fields: missingPreferred,
    satisfied_fields: satisfied,
    collected,
    speak,
  };
}

function buildMissingFieldsSpeak(
  requirements: FieldRequirement[],
  missingIds: string[],
): string {
  const prompts: string[] = [];
  for (const id of missingIds) {
    const req = requirements.find((r) => r.field_id === id);
    if (req?.ask_prompt) prompts.push(req.ask_prompt);
    else if (req?.label) prompts.push(`I still need your ${req.label.toLowerCase()}.`);
  }
  if (prompts.length === 1) return prompts[0];
  if (prompts.length === 2) return `${prompts[0]} Also, ${prompts[1].charAt(0).toLowerCase()}${prompts[1].slice(1)}`;
  return `I still need a few details: ${missingIds.map((id) => requirements.find((r) => r.field_id === id)?.label || id).join(", ")}.`;
}

export async function checkCustomerFieldsForCall(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  workflow: WorkflowAction;
  serviceName?: string;
  incomingArgs?: Record<string, unknown>;
}): Promise<CustomerCompletenessResult> {
  const requirements = await resolveWorkflowFieldRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });

  let state = input.callId
    ? await seedCollectedStateFromCall({
        callId: input.callId,
        workspaceId: input.workspaceId,
      })
    : { fields: {}, custom_fields: {}, updated_at: new Date().toISOString() };

  if (input.callId) {
    state = await loadCustomerCollectedState(input.callId).catch(() => state);
    if (!Object.keys(state.fields).length) {
      state = await seedCollectedStateFromCall({
        callId: input.callId,
        workspaceId: input.workspaceId,
      });
    }
  }

  return evaluateCustomerCompleteness({
    requirements,
    state,
    incomingArgs: input.incomingArgs,
    workflow: input.workflow,
  });
}

export function completenessToToolResponse(
  result: CustomerCompletenessResult,
): Record<string, unknown> {
  return {
    ok: result.complete,
    success: result.complete,
    complete: result.complete,
    workflow: result.workflow,
    missing_required_fields: result.missing_required_fields,
    missing_preferred_fields: result.missing_preferred_fields,
    satisfied_fields: result.satisfied_fields,
    collected: result.collected,
    speak: result.speak,
    message: result.complete
      ? "All required information is collected."
      : result.speak || "Some required information is still missing.",
  };
}
