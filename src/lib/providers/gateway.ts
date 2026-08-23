/**
 * Central provider gateway registry (brief Part 6).
 *
 * Feature code should import capability helpers from here (or from
 * `@/lib/providers/*` modules which already share timeout/circuit/logging).
 * Messaging (Twilio/Brevo) and Maps KD should migrate onto this entry over time.
 */

import {
  assertCircuitClosed,
  ProviderCircuitOpenError,
  ProviderTimeoutError,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  fetchWithTimeout,
  estimateProviderCost,
} from "@/lib/providers/fetch-with-timeout";
import { recordUsage } from "@/lib/platform/usage-ledger";

export type ProviderName =
  | "brightdata"
  | "dataforseo"
  | "scrapingdog"
  | "deepseek"
  | "gemini"
  | "anthropic"
  | "cloro"
  | "kimi"
  | "twilio"
  | "brevo"
  | "nominatim"
  | string;

export type ProviderCallContext = {
  organizationId?: string | null;
  businessId?: string | null;
  jobId?: string | null;
  feature: string;
  unitType?: string;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  actualUnits?: number | null;
  idempotencyKey?: string | null;
};

export {
  assertCircuitClosed,
  ProviderCircuitOpenError,
  ProviderTimeoutError,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  fetchWithTimeout,
  estimateProviderCost,
};

/** Record successful provider spend into the platform usage ledger. */
export async function trackProviderUsage(
  provider: ProviderName,
  ctx: ProviderCallContext
): Promise<void> {
  if (!ctx.organizationId) return;
  await recordUsage({
    organizationId: ctx.organizationId,
    businessId: ctx.businessId,
    jobId: ctx.jobId,
    feature: ctx.feature,
    provider,
    unitType: ctx.unitType ?? "request",
    estimatedCostUsd: ctx.estimatedCostUsd,
    actualCostUsd: ctx.actualCostUsd,
    actualUnits: ctx.actualUnits ?? 1,
    idempotencyKey: ctx.idempotencyKey,
  });
}

/** Classify errors for retry policy (brief Part 20). */
export function classifyProviderError(err: unknown): "retryable" | "permanent" {
  if (err instanceof ProviderTimeoutError || err instanceof ProviderCircuitOpenError) {
    return "retryable";
  }
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();
  if (status === 429 || status === 408 || (status != null && status >= 500)) return "retryable";
  if (
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("temporar") ||
    msg.includes("rate limit")
  ) {
    return "retryable";
  }
  if (
    msg.includes("invalid") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("not found") ||
    msg.includes("disabled")
  ) {
    return "permanent";
  }
  return "retryable";
}

export function providerHealth(provider: ProviderName): {
  provider: string;
  circuitOpen: boolean;
} {
  try {
    assertCircuitClosed(provider);
    return { provider, circuitOpen: false };
  } catch (err) {
    if (err instanceof ProviderCircuitOpenError) {
      return { provider, circuitOpen: true };
    }
    return { provider, circuitOpen: false };
  }
}

/** Re-exports of primary capability modules — single import surface for features. */
export { mapsGridCell } from "@/lib/providers/brightdata";
export { placeReviews as fetchReviewsForPlace } from "@/lib/providers/scrapingdog";
export { sendTwilioSms } from "@/lib/reputation/twilio";
export { sendBrevoEmail } from "@/lib/reputation/brevo";
