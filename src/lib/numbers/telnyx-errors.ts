import { TelnyxApiError } from "@/lib/messaging/telnyx/client";

export type NormalizedTelnyxCategory =
  | "NUMBER_UNAVAILABLE"
  | "INVALID_NUMBER"
  | "AUTHENTICATION_FAILED"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_TEMPORARY_FAILURE"
  | "DESTINATION_BUSY"
  | "DESTINATION_NO_ANSWER"
  | "CALL_FAILED"
  | "INVALID_CONFIGURATION"
  | "UNKNOWN_PROVIDER_FAILURE";

export type TelnyxOperationOutcome =
  | "SUCCESS"
  | "RECOVERABLE_FAILURE"
  | "TERMINAL_FAILURE"
  | "NEEDS_INFORMATION";

export type NormalizedTelnyxError = {
  category: NormalizedTelnyxCategory;
  outcome: TelnyxOperationOutcome;
  message: string;
  providerStatus?: number;
  providerCode?: string;
  retryable: boolean;
};

function messageFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const errors = (body as { errors?: Array<{ detail?: string; title?: string; code?: string }> })
    .errors;
  if (errors?.length) {
    return errors.map((e) => e.detail || e.title || e.code).filter(Boolean).join("; ");
  }
  return undefined;
}

export function normalizeTelnyxError(err: unknown): NormalizedTelnyxError {
  if (err instanceof TelnyxApiError) {
    const detail = messageFromBody(err.body) || err.message;
    const lower = detail.toLowerCase();

    if (err.status === 401 || err.status === 403) {
      return {
        category: err.status === 401 ? "AUTHENTICATION_FAILED" : "PERMISSION_DENIED",
        outcome: "TERMINAL_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: false,
      };
    }
    if (err.status === 429) {
      return {
        category: "RATE_LIMITED",
        outcome: "RECOVERABLE_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: true,
      };
    }
    if (err.status === 408 || lower.includes("timeout")) {
      return {
        category: "TIMEOUT",
        outcome: "RECOVERABLE_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: true,
      };
    }
    if (
      lower.includes("not available") ||
      lower.includes("unavailable") ||
      lower.includes("already in use") ||
      lower.includes("not found")
    ) {
      return {
        category: "NUMBER_UNAVAILABLE",
        outcome: "TERMINAL_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: false,
      };
    }
    if (lower.includes("invalid") && lower.includes("number")) {
      return {
        category: "INVALID_NUMBER",
        outcome: "TERMINAL_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: false,
      };
    }
    if (err.status >= 500) {
      return {
        category: "PROVIDER_TEMPORARY_FAILURE",
        outcome: "RECOVERABLE_FAILURE",
        message: detail,
        providerStatus: err.status,
        retryable: true,
      };
    }
    return {
      category: "UNKNOWN_PROVIDER_FAILURE",
      outcome: "TERMINAL_FAILURE",
      message: detail,
      providerStatus: err.status,
      retryable: false,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    category: "UNKNOWN_PROVIDER_FAILURE",
    outcome: "TERMINAL_FAILURE",
    message,
    retryable: false,
  };
}
