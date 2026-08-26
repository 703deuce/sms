import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import {
  MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
  MASS_TEXT_MONTHLY_PLANS,
  MASS_TEXT_PAYG_LINE,
  MASS_TEXT_PAYG_PACKS,
  MASS_TEXT_ADDITIONAL_NUMBER,
  massTextA2pFeeRequired,
  parseMassTextCheckoutKey,
  type MassTextCheckoutKey,
} from "@/lib/mass-texting/pricing";
import { getMassTextingStripePriceId } from "@/lib/mass-texting/stripe-catalog";
import { getOrCreateMassTextingBillingAccount } from "@/lib/mass-texting/billing-account";

export async function createMassTextingCheckoutSession(input: {
  workspaceId: string;
  productKey: MassTextCheckoutKey;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");

  const parsed = parseMassTextCheckoutKey(input.productKey);
  if (!parsed) throw new Error(`Unknown Mass Texting product: ${input.productKey}`);

  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const base = getAppBaseUrl();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadata: Record<string, string> = {
    workspaceId: input.workspaceId,
    massTextProductKey: input.productKey,
    product: "mass_texting",
    pricingVersion: "1",
  };

  const account = await getOrCreateMassTextingBillingAccount(input.workspaceId);

  if (parsed.kind === "monthly") {
    const plan = MASS_TEXT_MONTHLY_PLANS[parsed.tier];
    const priceId = getMassTextingStripePriceId(`monthly_${parsed.tier}`);
    lineItems.push({ price: priceId, quantity: 1 });
    metadata.billingModel = "monthly";
    metadata.monthlyTier = parsed.tier;
    const a2pRequired = massTextA2pFeeRequired({
      billingModel: "monthly",
      monthlyTier: parsed.tier,
      a2pFeeStatus: account.a2pFeeStatus,
    });
    metadata.a2pWaived = a2pRequired ? "false" : "true";
    if (a2pRequired) {
      lineItems.push({
        price: getMassTextingStripePriceId("a2p_registration"),
        quantity: 1,
      });
    }
  } else if (parsed.kind === "payg_line") {
    lineItems.push({ price: getMassTextingStripePriceId("payg_line"), quantity: 1 });
    metadata.billingModel = "payg";
  } else if (parsed.kind === "payg_pack") {
    const pack = MASS_TEXT_PAYG_PACKS[parsed.pack];
    lineItems.push({ price: getMassTextingStripePriceId(parsed.pack), quantity: 1 });
    metadata.billingModel = "payg";
    metadata.paygPack = parsed.pack;
    const a2pRequired = massTextA2pFeeRequired({
      billingModel: "payg",
      paygPack: parsed.pack,
      a2pFeeStatus: account.a2pFeeStatus,
    });
    metadata.a2pWaived = a2pRequired ? "false" : "true";
    if (a2pRequired) {
      lineItems.push({
        price: getMassTextingStripePriceId("a2p_registration"),
        quantity: 1,
      });
    }
  } else if (parsed.kind === "a2p_registration") {
    lineItems.push({ price: getMassTextingStripePriceId("a2p_registration"), quantity: 1 });
  } else if (parsed.kind === "additional_number") {
    lineItems.push({ price: getMassTextingStripePriceId("additional_number"), quantity: 1 });
  }

  const mode: Stripe.Checkout.SessionCreateParams.Mode =
    parsed.kind === "payg_pack" || parsed.kind === "a2p_registration"
      ? "payment"
      : "subscription";

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    line_items: lineItems,
    success_url: input.successUrl || `${base}/sms/settings?checkout=success`,
    cancel_url: input.cancelUrl || `${base}/sms/settings?checkout=canceled`,
    metadata,
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata,
          },
        }
      : {}),
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

export function massTextingCheckoutAmountCents(productKey: MassTextCheckoutKey): number {
  const parsed = parseMassTextCheckoutKey(productKey);
  if (!parsed) return 0;
  if (parsed.kind === "monthly") return MASS_TEXT_MONTHLY_PLANS[parsed.tier].monthlyPriceCents;
  if (parsed.kind === "payg_line") return MASS_TEXT_PAYG_LINE.monthlyPriceCents;
  if (parsed.kind === "payg_pack") return MASS_TEXT_PAYG_PACKS[parsed.pack].priceCents;
  if (parsed.kind === "a2p_registration") return MASS_TEXT_A2P_REGISTRATION_FEE_CENTS;
  if (parsed.kind === "additional_number") return MASS_TEXT_ADDITIONAL_NUMBER.monthlyPriceCents;
  return 0;
}
