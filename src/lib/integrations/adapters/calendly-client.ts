/**
 * Canonical Calendly REST client (API v2).
 * All server-side Calendly HTTP must go through this module or calendly.ts `api()` which delegates here.
 *
 * @see docs/runtime-rules/providers/CALENDLY-BOOKING-RULES.md
 */
import { IntegrationHttpError, integrationFetch, sleep } from "../framework/http";
import type { AdapterContext } from "../framework/types";

export const CALENDLY_API_BASE = "https://api.calendly.com";

/** Maximum event_type_available_times query span (Calendly, July 2026). Rule CAL-AVL-002 */
export const CALENDLY_MAX_AVAILABILITY_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

/** Stricter Create Event Invitee limits — connector must not hammer POST /invitees. Rule CAL-RATE-002 */
export const CALENDLY_INVITEE_RATE_LIMITS_DOC = {
  paidNonEnterprise: { perMinute: 10, perHour: 50, perDay: 100 },
  enterprise: { perMinute: 500 },
};

export type CalendlyErrorCode =
  | "CALENDLY_AUTH_REQUIRED"
  | "CALENDLY_MISSING_SCOPE"
  | "CALENDLY_TOKEN_REFRESH_FAILED"
  | "CALENDLY_PLAN_REQUIRED"
  | "CALENDLY_EVENT_TYPE_NOT_FOUND"
  | "CALENDLY_EVENT_TYPE_INACTIVE"
  | "CALENDLY_SLOT_UNAVAILABLE"
  | "CALENDLY_REQUIRED_DATA_MISSING"
  | "CALENDLY_INVALID_LOCATION"
  | "CALENDLY_RATE_LIMITED"
  | "CALENDLY_PROVIDER_UNAVAILABLE"
  | "CALENDLY_BOOKING_NOT_FOUND"
  | "CALENDLY_VALIDATION_ERROR"
  | "CALENDLY_UNKNOWN";

export class CalendlyConnectorError extends Error {
  code: CalendlyErrorCode;
  status: number;
  retryable: boolean;
  rateLimitResetAt: number | null;

  constructor(
    code: CalendlyErrorCode,
    message: string,
    status: number,
    opts?: { retryable?: boolean; rateLimitResetAt?: number | null },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = opts?.retryable ?? false;
    this.rateLimitResetAt = opts?.rateLimitResetAt ?? null;
  }
}

export function parseCalendlyRateLimitReset(headers: Headers): number | null {
  const reset = headers.get("X-RateLimit-Reset");
  if (!reset) return null;
  const n = Number(reset);
  if (!Number.isFinite(n)) return null;
  return n > 1e12 ? n : n * 1000;
}

export function normalizeCalendlyHttpError(err: unknown, op: string): CalendlyConnectorError {
  if (err instanceof CalendlyConnectorError) return err;
  const status = err instanceof IntegrationHttpError ? err.status : 0;
  const raw =
    err instanceof Error ? err.message : String(err);
  const body =
    err instanceof IntegrationHttpError ? err.body : undefined;
  const detail =
    typeof body === "object" && body && "message" in body
      ? String((body as { message?: unknown }).message)
      : raw;

  if (status === 401 || /invalid_token|unauthor/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_AUTH_REQUIRED",
      `Calendly ${op}: authentication required (${detail.slice(0, 120)})`,
      status,
    );
  }
  if (status === 403 && /scope|forbidden|permission/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_MISSING_SCOPE",
      `Calendly ${op}: missing OAuth scope (${detail.slice(0, 120)})`,
      status,
    );
  }
  if (status === 403 || status === 402 || /plan|standard|teams|enterprise|upgrade|subscription/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_PLAN_REQUIRED",
      `Calendly ${op}: plan or capability restriction (${detail.slice(0, 120)})`,
      status,
    );
  }
  if (status === 429 || /rate.?limit/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_RATE_LIMITED",
      `Calendly ${op}: rate limited`,
      status || 429,
      { retryable: true },
    );
  }
  if (status === 404) {
    return new CalendlyConnectorError(
      "CALENDLY_BOOKING_NOT_FOUND",
      `Calendly ${op}: not found`,
      status,
    );
  }
  if (/not available|slot|conflict/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_SLOT_UNAVAILABLE",
      `Calendly ${op}: slot unavailable`,
      status || 409,
    );
  }
  if (/required|must provide|invalid email/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_REQUIRED_DATA_MISSING",
      `Calendly ${op}: required invitee data missing`,
      status || 422,
    );
  }
  if (/location/i.test(detail)) {
    return new CalendlyConnectorError(
      "CALENDLY_INVALID_LOCATION",
      `Calendly ${op}: invalid location for event type`,
      status || 422,
    );
  }
  if (status >= 500) {
    return new CalendlyConnectorError(
      "CALENDLY_PROVIDER_UNAVAILABLE",
      `Calendly ${op}: provider error`,
      status,
      { retryable: true },
    );
  }
  return new CalendlyConnectorError(
    "CALENDLY_UNKNOWN",
    `Calendly ${op} failed: ${detail.slice(0, 200)}`,
    status || 500,
  );
}

/** CAL-AVL-001: build query params for GET /event_type_available_times */
export function buildCalendlyAvailabilityRequest(input: {
  eventTypeUri: string;
  startTimeIso: string;
  endTimeIso: string;
}): { params: URLSearchParams; chunks?: Array<{ start: string; end: string }> } {
  const start = new Date(input.startTimeIso);
  const end = new Date(input.endTimeIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new CalendlyConnectorError(
      "CALENDLY_VALIDATION_ERROR",
      "Invalid availability window timestamps",
      400,
    );
  }
  if (end.getTime() <= start.getTime()) {
    throw new CalendlyConnectorError(
      "CALENDLY_VALIDATION_ERROR",
      "Availability end must be after start",
      400,
    );
  }
  const span = end.getTime() - start.getTime();
  if (span <= CALENDLY_MAX_AVAILABILITY_WINDOW_MS) {
    const params = new URLSearchParams({
      event_type: input.eventTypeUri,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
    return { params };
  }
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = start.getTime();
  const endMs = end.getTime();
  while (cursor < endMs) {
    const chunkEnd = Math.min(cursor + CALENDLY_MAX_AVAILABILITY_WINDOW_MS, endMs);
    chunks.push({
      start: new Date(cursor).toISOString(),
      end: new Date(chunkEnd).toISOString(),
    });
    cursor = chunkEnd;
  }
  const first = chunks[0]!;
  const params = new URLSearchParams({
    event_type: input.eventTypeUri,
    start_time: first.start,
    end_time: first.end,
  });
  return { params, chunks };
}

export async function calendlyApiFetch<T = Record<string, unknown>>(
  path: string,
  ctx: AdapterContext,
  init?: RequestInit & { timeoutMs?: number; op?: string },
): Promise<T> {
  const op = init?.op || path.split("?")[0] || "request";
  const url = path.startsWith("http") ? path : `${CALENDLY_API_BASE}${path}`;
  try {
    return await integrationFetch<T>(url, {
      ...init,
      accessToken: ctx.accessToken,
    });
  } catch (err) {
    throw normalizeCalendlyHttpError(err, op);
  }
}

/** Bounded retry for safe GETs after 429. Mutations must not use blind retry. Rule CAL-RATE-003 */
export async function calendlyApiFetchWithRateLimitRetry<T>(
  path: string,
  ctx: AdapterContext,
  init?: RequestInit & { timeoutMs?: number; op?: string; maxAttempts?: number },
): Promise<T> {
  const attempts = init?.maxAttempts ?? 2;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await calendlyApiFetch<T>(path, ctx, init);
    } catch (err) {
      last = err;
      if (err instanceof CalendlyConnectorError && err.code === "CALENDLY_RATE_LIMITED" && i < attempts - 1) {
        const waitMs = err.rateLimitResetAt
          ? Math.max(500, err.rateLimitResetAt - Date.now())
          : 1500 * (i + 1);
        await sleep(Math.min(waitMs, 30_000));
        continue;
      }
      throw err;
    }
  }
  throw last;
}
