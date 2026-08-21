import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getMarketplaceBillingProduct } from "@/lib/payments/marketplace-billing-catalog";
import {
  buildServiceSubscriptionMetadata,
  type MarketplaceServiceKey,
} from "@/lib/payments/stripe-marketplace-metadata";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getStripe } from "@/lib/stripe/client";

export async function createMarketplaceServiceCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  phoneNumberId: string;
  service: MarketplaceServiceKey;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");

  const product = await getMarketplaceBillingProduct(input.service);
  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const base = getAppBaseUrl();
  const metadata = buildServiceSubscriptionMetadata({
    workspaceId: input.workspaceId,
    userId: input.userId,
    phoneNumberId: input.phoneNumberId,
    service: input.service,
  });

  const successPath =
    input.service === "vault"
      ? "/personal/vault"
      : input.service === "voicemail"
        ? "/personal/voicemail"
        : "/personal/forwarding";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: product.stripePriceId!, quantity: 1 }],
    success_url: input.successUrl || `${base}${successPath}?subscribed=${input.service}`,
    cancel_url: input.cancelUrl || `${base}${successPath}?canceled=${input.service}`,
    metadata,
    subscription_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
