import type { MicrosoftGraphError } from "@/lib/microsoft/graph-helpers";

/** Normalized Microsoft Graph errors for MCTB + calendar connector. Rule MS-ERR-001 */
export type MicrosoftErrorCode =
  | "MICROSOFT_AUTH_REQUIRED"
  | "MICROSOFT_SCOPE_MISSING"
  | "MICROSOFT_REFRESH_FAILED"
  | "MICROSOFT_CALENDAR_NOT_FOUND"
  | "MICROSOFT_CALENDAR_READ_ONLY"
  | "MICROSOFT_UNSUPPORTED_ACCOUNT_TYPE"
  | "MICROSOFT_AVAILABILITY_UNSUPPORTED"
  | "MICROSOFT_SLOT_UNAVAILABLE"
  | "MICROSOFT_EVENT_NOT_FOUND"
  | "MICROSOFT_EVENT_NOT_EDITABLE"
  | "MICROSOFT_NOT_ORGANIZER"
  | "MICROSOFT_INVALID_TIMEZONE"
  | "MICROSOFT_RATE_LIMITED"
  | "MICROSOFT_PROVIDER_UNAVAILABLE"
  | "MICROSOFT_VALIDATION_ERROR"
  | "MICROSOFT_UNKNOWN";

export class MicrosoftConnectorError extends Error {
  code: MicrosoftErrorCode;
  httpStatus: number;
  retryable: boolean;
  retryAfterMs: number | null;

  constructor(
    code: MicrosoftErrorCode,
    message: string,
    httpStatus: number,
    opts?: { retryable?: boolean; retryAfterMs?: number | null },
  ) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = opts?.retryable ?? false;
    this.retryAfterMs = opts?.retryAfterMs ?? null;
  }
}

export function normalizeMicrosoftGraphFailure(
  graphError: MicrosoftGraphError,
  op: string,
): MicrosoftConnectorError {
  const status = graphError.httpStatus;
  const msg = graphError.graphMessage || `Microsoft Graph ${status}`;
  const code = (graphError.graphCode || "").toLowerCase();

  if (status === 401) {
    return new MicrosoftConnectorError(
      "MICROSOFT_AUTH_REQUIRED",
      `${op}: authentication required`,
      status,
    );
  }
  if (status === 403) {
    return new MicrosoftConnectorError(
      code.includes("scope") ? "MICROSOFT_SCOPE_MISSING" : "MICROSOFT_EVENT_NOT_EDITABLE",
      `${op}: ${msg.slice(0, 160)}`,
      status,
    );
  }
  if (status === 429) {
    return new MicrosoftConnectorError(
      "MICROSOFT_RATE_LIMITED",
      `${op}: rate limited`,
      status,
      { retryable: true },
    );
  }
  if (status === 404) {
    return new MicrosoftConnectorError(
      "MICROSOFT_EVENT_NOT_FOUND",
      `${op}: not found`,
      status,
    );
  }
  if (status >= 500) {
    return new MicrosoftConnectorError(
      "MICROSOFT_PROVIDER_UNAVAILABLE",
      `${op}: provider error`,
      status,
      { retryable: true },
    );
  }
  return new MicrosoftConnectorError("MICROSOFT_UNKNOWN", `${op}: ${msg.slice(0, 200)}`, status);
}

export function parseRetryAfterMs(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}
