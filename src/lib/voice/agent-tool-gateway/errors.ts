import type { AgentToolErrorCode, AgentToolResult } from "./types";

export class AgentToolError extends Error {
  constructor(
    public readonly code: AgentToolErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = "AgentToolError";
  }
}

export function translateError(err: unknown): AgentToolError {
  if (err instanceof AgentToolError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (/missing required booking field/i.test(message)) {
    return new AgentToolError("MISSING_REQUIRED_FIELD", message, false, message);
  }
  if (/copied exactly|slots\[\]/i.test(message)) {
    return new AgentToolError(
      "SLOT_NOT_IN_AVAILABILITY",
      message,
      false,
      "That time is not available. Please choose one of the times I offered.",
    );
  }
  if (/slot no longer available|not available|empty slots/i.test(lower)) {
    return new AgentToolError(
      "SLOT_UNAVAILABLE",
      message,
      true,
      "That time is no longer available. I can check other openings.",
    );
  }
  if (/policy|approval required|does not allow direct booking/i.test(lower)) {
    return new AgentToolError("POLICY_BLOCKED", message, false, message);
  }
  if (/already confirmed|already booked|already_completed/i.test(lower)) {
    return new AgentToolError(
      "ALREADY_COMPLETED",
      message,
      false,
      "That appointment is already confirmed.",
    );
  }
  if (/auth|token|reconnect|oauth/i.test(lower)) {
    return new AgentToolError(
      "AUTH_REQUIRED",
      message,
      false,
      "Calendar connection needs attention. I can take a message for the team.",
    );
  }
  if (/timeout|temporarily|503|502|rate limit/i.test(lower)) {
    return new AgentToolError(
      "TEMPORARY_PROVIDER_ERROR",
      message,
      true,
      "I'm having a brief issue with scheduling. One moment or I can take a callback message.",
    );
  }
  if (/invalid|required|must be/i.test(lower)) {
    return new AgentToolError("INVALID_INPUT", message, false, message);
  }
  return new AgentToolError(
    "INTERNAL_ERROR",
    message,
    true,
    "Something went wrong on my end. I can try again or take a message.",
  );
}

export function failResult(
  err: AgentToolError,
  operationId: string | null = null,
): AgentToolResult {
  return {
    success: false,
    ok: false,
    status: "failed",
    data: {},
    user_message: err.userMessage || err.message,
    speak: err.userMessage || err.message,
    retryable: err.retryable,
    error_code: err.code,
    operation_id: operationId,
  };
}
