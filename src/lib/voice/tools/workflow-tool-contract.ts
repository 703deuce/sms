/**
 * Compact semantic tool results for Telnyx workflow agents.
 * Provider/debug metadata stays server-side.
 */

export const WORKFLOW_TOOL_STATUSES = [
  "success",
  "not_found",
  "not_configured",
  "invalid_input",
  "not_allowed",
  "already_completed",
  "temporarily_unavailable",
  "timeout",
] as const;

export type WorkflowToolStatus = (typeof WORKFLOW_TOOL_STATUSES)[number];

export type WorkflowToolResponse = {
  ok: boolean;
  status: WorkflowToolStatus;
  result: string;
  speak?: string;
  dynamic_variables?: Record<string, string>;
};

export function workflowToolResponse(input: {
  status: WorkflowToolStatus;
  result: string;
  speak?: string;
  dynamicVariables?: Record<string, string | boolean | null | undefined>;
}): WorkflowToolResponse {
  const dynamic_variables: Record<string, string> = {};
  if (input.dynamicVariables) {
    for (const [key, value] of Object.entries(input.dynamicVariables)) {
      if (value == null) continue;
      dynamic_variables[key] = String(value);
    }
  }
  const ok =
    input.status === "success" || input.status === "already_completed";
  return {
    ok,
    status: input.status,
    result: input.result,
    ...(input.speak ? { speak: input.speak } : {}),
    ...(Object.keys(dynamic_variables).length ? { dynamic_variables } : {}),
  };
}

export function telnyxToolJsonBody(response: WorkflowToolResponse): Record<string, unknown> {
  return {
    ...response,
    ...(response.dynamic_variables
      ? { dynamic_variables: response.dynamic_variables }
      : {}),
  };
}
