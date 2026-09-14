import type { MctbDurableFailureClass } from "./types";

export function classifyErrorForRetry(err: unknown): {
  failureClass: MctbDurableFailureClass;
  retryable: boolean;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return { failureClass: "ATTEMPT_TIMED_OUT", retryable: true, message };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("503") || lower.includes("502")) {
    return { failureClass: "TRANSIENT_PROVIDER", retryable: true, message };
  }
  if (lower.includes("deepseek") || lower.includes("model") || lower.includes("llm")) {
    return { failureClass: "TRANSIENT_MODEL", retryable: true, message };
  }
  if (
    lower.includes("econnreset") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("socket")
  ) {
    return { failureClass: "TRANSIENT_NETWORK", retryable: true, message };
  }
  if (lower.includes("stale") || lower.includes("no longer active")) {
    return { failureClass: "STALE_ACTION", retryable: false, message };
  }
  if (lower.includes("policy") || lower.includes("denied") || lower.includes("not allowed")) {
    return { failureClass: "POLICY_DENIED", retryable: false, message };
  }
  if (lower.includes("invalid") || lower.includes("required")) {
    return { failureClass: "INVALID_INPUT", retryable: false, message };
  }
  return { failureClass: "UNKNOWN", retryable: true, message };
}

export function computeRetryBackoffMs(attemptCount: number): number {
  const base = Math.min(300_000, 2_000 * Math.pow(2, Math.max(0, attemptCount - 1)));
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}
