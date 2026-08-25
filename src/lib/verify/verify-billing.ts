import "server-only";

import type Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getStripe } from "@/lib/stripe/client";
import {
  creditsForVerifyPack,
  parseCheckoutSelection,
  type VerifyCreditPack,
} from "@/lib/products/platform-billing-catalog";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { appendVerifyCreditLedger } from "./verify-credits";

export async function createVerifyCreditsCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  productKey: string;
  origin: string;
  returnPath?: string;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const selection = parseCheckoutSelection(input.productKey);
  if (selection.family !== "verify_pack" || !selection.verifyPack) {
    throw new Error("Invalid verify credit pack");
  }

  const pack = selection.verifyPack as VerifyCreditPack;
  const credits = creditsForVerifyPack(pack);
  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const returnPath = input.returnPath || "/verify/billing";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: selection.stripePriceId, quantity: 1 }],
    success_url: `${input.origin}${returnPath}?verify_checkout=success&pack=${pack}`,
    cancel_url: `${input.origin}${returnPath}?verify_checkout=cancel`,
    metadata: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      platformProductKey: input.productKey,
      verifyCreditPack: pack,
      verifyCredits: String(credits),
      checkoutType: "verify_credits",
    },
    payment_intent_data: {
      metadata: {
        workspaceId: input.workspaceId,
        platformProductKey: input.productKey,
        verifyCreditPack: pack,
        verifyCredits: String(credits),
        checkoutType: "verify_credits",
      },
    },
  });

  return { url: session.url, sessionId: session.id };
}

export async function handleVerifyCreditsCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<{ handled: boolean; credits?: number }> {
  if (session.metadata?.checkoutType !== "verify_credits") return { handled: false };

  const workspaceId = session.metadata.workspaceId;
  const pack = session.metadata.verifyCreditPack as VerifyCreditPack | undefined;
  const credits = Number(session.metadata.verifyCredits || 0);
  if (!workspaceId || !pack || credits <= 0) return { handled: false };

  await appendVerifyCreditLedger({
    workspaceId,
    entryType: "purchase",
    amount: credits,
    referenceType: "stripe_checkout",
    referenceId: session.id,
    stripeSessionId: session.id,
    idempotencyKey: `verify-purchase:${session.id}`,
    description: `Purchased ${credits.toLocaleString()} verification credits`,
    metadata: { pack },
  });

  await grantWorkspaceProductFeature(workspaceId, "verify", "active");

  return { handled: true, credits };
}

export function verifyCheckoutSuccessUrl(pack: VerifyCreditPack, returnPath = "/verify/billing") {
  const base = getAppBaseUrl();
  return `${base}${returnPath}?verify_checkout=success&pack=${pack}`;
}
