import type { AgentToolResult, AgentToolStatus } from "./types";

export function toolSuccess<T extends Record<string, unknown>>(input: {
  status: AgentToolStatus;
  data: T;
  user_message: string;
  operation_id?: string | null;
  retryable?: boolean;
}): AgentToolResult<T> {
  return {
    success: true,
    ok: true,
    status: input.status,
    data: input.data,
    user_message: input.user_message,
    speak: input.user_message,
    retryable: input.retryable ?? false,
    error_code: null,
    operation_id: input.operation_id ?? null,
  };
}

/** Map gateway envelope to legacy builtin-actions shape Telnyx already consumes. */
export function toLegacyVoiceShape(result: AgentToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    success: result.success,
    status: result.status,
    speak: result.speak,
    message: result.user_message,
    user_message: result.user_message,
    retryable: result.retryable,
    error_code: result.error_code,
    operation_id: result.operation_id,
    ...result.data,
    ...(result.success
      ? {}
      : { error: result.user_message || "Tool failed" }),
  };
}
