import type { FieldRequirement, CustomerCompletenessResult, WorkflowAction } from "./types";
import type { CustomerCollectedState } from "./types";
import {
  flattenCollectedForBookingArgs,
  loadCustomerCollectedState,
  seedCollectedStateFromCall,
} from "./collected-state";
import { resolveWorkflowFieldRequirements } from "./resolver";
import { buildFieldSubmissionHints } from "./field-hints";

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
  const hints = buildFieldSubmissionHints(input.requirements, missingRequired);
  const speak = !complete
    ? buildMissingFieldsSpeak(input.requirements, missingRequired, hints)
    : null;

  return {
    complete,
    workflow: input.workflow,
    missing_required_fields: missingRequired,
    missing_preferred_fields: missingPreferred,
    satisfied_fields: satisfied,
    collected,
    speak,
    field_submission_hints: hints,
  };
}

function buildMissingFieldsSpeak(
  requirements: FieldRequirement[],
  missingIds: string[],
  hints: ReturnType<typeof buildFieldSubmissionHints>,
): string {
  const prompts: string[] = [];
  for (const id of missingIds) {
    const hint = hints.find((h) => h.field_id === id || h.field_id === requirements.find((r) => r.field_id === id)?.field_id);
    const req = requirements.find((r) => r.field_id === id);
    if (hint?.ask_prompt) prompts.push(hint.ask_prompt);
    else if (req?.ask_prompt) prompts.push(req.ask_prompt);
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
  result: CustomerCompletenessResult & {
    field_submission_hints?: ReturnType<typeof buildFieldSubmissionHints>;
  },
): Record<string, unknown> {
  const hints = result.field_submission_hints || [];
  const nextAction =
    hints.length > 0
      ? `Call save_caller_info with ${JSON.stringify(hints[0].example_payload)} then retry.`
      : null;
  return {
    ok: true,
    success: true,
    workflow_complete: result.complete,
    complete: result.complete,
    workflow: result.workflow,
    missing_required_fields: result.missing_required_fields,
    missing_preferred_fields: result.missing_preferred_fields,
    satisfied_fields: result.satisfied_fields,
    collected: result.collected,
    field_submission_hints: hints,
    next_action: nextAction,
    speak: result.speak,
    message: result.complete
      ? "All required information is collected."
      : result.speak || "Some required information is still missing.",
  };
}
