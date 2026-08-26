/**
 * Classify SMS/MMS provider failures for Mass Texting send retries.
 * Terminal 4xx must not retry; 429/5xx/timeouts may retry with backoff.
 */

export type MassTextProviderErrorClass = "retryable" | "terminal";

const TERMINAL_STATUS = new Set([400, 401, 403, 404, 410, 422]);
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function classifySmsProviderError(error: string | null | undefined): MassTextProviderErrorClass {
  const text = String(error || "");
  const statusMatch = text.match(/\b(HTTP[_\s-]?|status[_\s:=]+)?(\d{3})\b/i);
  const status = statusMatch ? Number(statusMatch[2]) : NaN;

  if (Number.isFinite(status)) {
    if (RETRYABLE_STATUS.has(status)) return "retryable";
    if (TERMINAL_STATUS.has(status) || (status >= 400 && status < 500 && status !== 429)) {
      return "terminal";
    }
    if (status >= 500) return "retryable";
  }

  if (/timeout|ECONNRESET|ENOTFOUND|ECONNREFUSED|socket|network|aborted|ETIMEDOUT|unavailable|too many requests|rate.?limit/i.test(text)) {
    return "retryable";
  }
  if (/unauthorized|forbidden|not found|invalid (to|from|number|payload)|unprocessable/i.test(text)) {
    return "terminal";
  }
  return "retryable";
}

export function maxProviderRetries(error: string | null | undefined): number {
  return classifySmsProviderError(error) === "retryable" ? 3 : 0;
}
