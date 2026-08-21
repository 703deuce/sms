export type MarketplaceTransactionType =
  | "marketplace_number_purchase"
  | "marketplace_subscription"
  | "saas_subscription"
  | "saas_credits"
  | "payment_link";

export type MarketplaceServiceKey = "vault" | "voicemail" | "forwarding_200";

export const MARKETPLACE_PRODUCT_KEY = "transovo_product_key";

export function readStripeMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  if (!metadata) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function resolveMarketplaceTransactionType(
  metadata: Record<string, string | undefined> | null | undefined,
): MarketplaceTransactionType | null {
  const m = readStripeMetadata(metadata);
  const explicit = m.transaction_type?.toLowerCase();
  if (explicit === "marketplace_number_purchase") return "marketplace_number_purchase";
  if (explicit === "marketplace_subscription") return "marketplace_subscription";
  if (explicit === "saas_subscription") return "saas_subscription";
  if (explicit === "saas_credits") return "saas_credits";
  if (explicit === "payment_link") return "payment_link";

  const legacyType = m.type?.toLowerCase();
  if (legacyType === "premium_number" || legacyType === "number_purchase") {
    return "marketplace_number_purchase";
  }
  if (legacyType === "credits") return "saas_credits";
  if (legacyType === "subscription" && m.service) return "marketplace_subscription";
  if (legacyType === "subscription") return "saas_subscription";
  if (m.paymentLinkId) return "payment_link";
  return null;
}

export function isMarketplaceNumberPurchaseMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  return resolveMarketplaceTransactionType(metadata) === "marketplace_number_purchase";
}

export function isMarketplaceSubscriptionMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  return resolveMarketplaceTransactionType(metadata) === "marketplace_subscription";
}

export function isSaasBillingMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  const type = resolveMarketplaceTransactionType(metadata);
  return type === "saas_subscription" || type === "saas_credits" || type === "payment_link";
}

export function buildNumberPurchaseMetadata(input: {
  workspaceId: string;
  userId: string;
  reservationId: string;
  phoneNumber: string;
  amountCents: number;
  provider: string;
}): Record<string, string> {
  return {
    transaction_type: "marketplace_number_purchase",
    type: "premium_number",
    workspaceId: input.workspaceId,
    userId: input.userId,
    reservationId: input.reservationId,
    phoneNumber: input.phoneNumber,
    amountCents: String(input.amountCents),
    provider: input.provider,
  };
}

export function buildServiceSubscriptionMetadata(input: {
  workspaceId: string;
  userId: string;
  phoneNumberId: string;
  service: MarketplaceServiceKey;
}): Record<string, string> {
  return {
    transaction_type: "marketplace_subscription",
    type: "subscription",
    service: input.service,
    workspaceId: input.workspaceId,
    userId: input.userId,
    phoneNumberId: input.phoneNumberId,
  };
}
