/** Stripe metadata helpers — one customer, product-tagged charges. */
import type { ProductKey } from "@/lib/products/types";

export type BillingProductMetadata = {
  product: ProductKey;
  service?: string;
  transaction_type?: string;
};

export function stripeMetadataForSmsPlan(planKey: string): BillingProductMetadata {
  return { product: "sms", service: planKey || "sms_plan" };
}

export function stripeMetadataForNumbersService(
  service: "vault" | "voicemail" | "forwarding" | "number_setup",
): BillingProductMetadata {
  if (service === "number_setup") {
    return { product: "numbers", transaction_type: "number_setup" };
  }
  return { product: "numbers", service };
}

export function filterBillingByProduct<T extends { metadata?: Record<string, string> | null }>(
  rows: T[],
  product: ProductKey,
): T[] {
  return rows.filter((row) => row.metadata?.product === product);
}
