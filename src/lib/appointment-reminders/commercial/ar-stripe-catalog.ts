import "server-only";

import {
  AR_PAID_PLAN_KEYS,
  arPlanDefinition,
  type ArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import { stripeBillingMode } from "@/lib/products/platform-billing-catalog";
import { AR_STRIPE_CATALOG_LIVE } from "@/lib/appointment-reminders/commercial/ar-stripe-catalog-ids-live";
import { AR_STRIPE_CATALOG_TEST } from "@/lib/appointment-reminders/commercial/ar-stripe-catalog-ids-test";

export type ArStripeCatalog = {
  productIds: Record<ArPlanKey, string | null>;
  priceIds: Record<ArPlanKey, string | null>;
};

export function getArStripeCatalog(): ArStripeCatalog {
  const raw = stripeBillingMode() === "test" ? AR_STRIPE_CATALOG_TEST : AR_STRIPE_CATALOG_LIVE;
  return raw;
}

export function resolveArStripePriceId(plan: ArPlanKey): string {
  if (plan === "free") throw new Error("Free plan has no Stripe price");
  const catalog = getArStripeCatalog();
  const priceId = catalog.priceIds[plan];
  if (!priceId || priceId.includes("placeholder")) {
    throw new Error(
      `Appointment Reminders Stripe price for ${plan} is not configured. Run: npx tsx scripts/sync-ar-stripe-catalog.ts --write-ids`,
    );
  }
  return priceId;
}

export function arCheckoutMetadata(input: {
  workspaceId: string;
  plan: ArPlanKey;
}): Record<string, string> {
  const def = arPlanDefinition(input.plan);
  return {
    workspaceId: input.workspaceId,
    platformProductFamily: "appointment_reminders",
    platformProductKey: `appointment_reminders_${input.plan}`,
    platformTier: input.plan,
    product: "appointment_reminders",
    planKey: input.plan,
    monthlyPriceCents: String(def.monthlyPriceCents),
    billingInterval: "month",
  };
}

export const AR_STRIPE_PAID_PLANS = AR_PAID_PLAN_KEYS;
