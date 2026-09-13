/**
 * Normalized Telnyx tool result contract for voice runtime.
 */
import type { WorkflowToolResponse } from "@/lib/voice/tools/workflow-tool-contract";

export type VoiceToolResultStatus =
  | "success"
  | "denied"
  | "temporary_failure"
  | "permanent_failure"
  | "not_found";

export type VoiceToolResult = {
  status: VoiceToolResultStatus;
  action: string;
  ok: boolean;
  message: string;
  caller_safe_summary: string;
  retryable?: boolean;
  fallback?: string;
  data?: Record<string, unknown>;
};

export function normalizeVoiceToolResult(input: {
  action: string;
  raw: Record<string, unknown>;
}): VoiceToolResult {
  const ok = input.raw.ok !== false && input.raw.success !== false;
  const speak =
    typeof input.raw.speak === "string"
      ? input.raw.speak
      : typeof input.raw.caller_safe_summary === "string"
        ? input.raw.caller_safe_summary
        : ok
          ? "Done."
          : "I wasn't able to complete that.";

  if (input.raw.error_code === "TOOL_NOT_ALLOWED" || input.raw.status === "not_allowed") {
    return {
      status: "denied",
      action: input.action,
      ok: false,
      message: String(input.raw.error || input.raw.error_code || "denied"),
      caller_safe_summary: speak,
      retryable: Boolean(input.raw.retryable),
      fallback: typeof input.raw.fallback === "string" ? input.raw.fallback : "capture_message",
      data: input.raw,
    };
  }

  if (!ok) {
    const retryable =
      Boolean(input.raw.retryable) ||
      input.raw.status === "temporarily_unavailable" ||
      input.raw.status === "timeout";
    return {
      status: retryable ? "temporary_failure" : "permanent_failure",
      action: input.action,
      ok: false,
      message: String(input.raw.error || input.raw.result || "failed"),
      caller_safe_summary: speak,
      retryable,
      fallback: "capture_message",
      data: input.raw,
    };
  }

  if (input.raw.status === "not_found") {
    return {
      status: "not_found",
      action: input.action,
      ok: false,
      message: String(input.raw.result || "not_found"),
      caller_safe_summary: speak,
      fallback: "capture_message",
      data: input.raw,
    };
  }

  return {
    status: "success",
    action: input.action,
    ok: true,
    message: String(input.raw.result || input.raw.message || "success"),
    caller_safe_summary: speak,
    data: input.raw,
  };
}

export function workflowResponseToTelnyxBody(
  action: string,
  response: WorkflowToolResponse,
): Record<string, unknown> {
  const normalized = normalizeVoiceToolResult({
    action,
    raw: response as unknown as Record<string, unknown>,
  });
  return {
    ...response,
    ok: normalized.ok,
    action: normalized.action,
    status: normalized.status,
    caller_safe_summary: normalized.caller_safe_summary,
    message: normalized.message,
    retryable: normalized.retryable,
    fallback: normalized.fallback,
  };
}
