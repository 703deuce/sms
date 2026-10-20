import "server-only";

import { getStripe } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/app-url";
import {
  getMerchantConnection,
  upsertMerchantConnection,
  type ConnectionRecord,
} from "./connection-store";

export function isStripeConnectPlatformConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function refreshStripeConnectAccount(
  workspaceId: string,
  connection: ConnectionRecord,
): Promise<ConnectionRecord> {
  const stripe = getStripe();
  if (!stripe || !connection.merchantAccountId) return connection;

  const account = await stripe.accounts.retrieve(connection.merchantAccountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const onboardingComplete = chargesEnabled && account.details_submitted;
  const needsAttention = Boolean(
    account.requirements?.currently_due?.length || account.requirements?.past_due?.length,
  );

  return upsertMerchantConnection(workspaceId, "STRIPE", {
    chargesEnabled,
    payoutsEnabled,
    onboardingComplete,
    status: needsAttention
      ? "needs_attention"
      : onboardingComplete && chargesEnabled
        ? "connected"
        : "onboarding_incomplete",
    providerMetadata: {
      requirements: account.requirements,
      capabilities: account.capabilities,
    },
    lastError: needsAttention ? "Stripe requires additional information" : null,
  });
}

export async function startStripeConnectOnboarding(workspaceId: string): Promise<{
  url: string;
  accountId: string;
}> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe platform is not configured");

  let connection = await getMerchantConnection(workspaceId, "STRIPE");
  let accountId = connection?.merchantAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { workspaceId, purpose: "appointment_merchant_payments" },
    });
    accountId = account.id;
    connection = await upsertMerchantConnection(workspaceId, "STRIPE", {
      merchantAccountId: accountId,
      status: "onboarding_incomplete",
      connectedAt: new Date(),
    });
  }

  const base = getAppBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/merchant-payments/stripe/refresh?workspaceId=${encodeURIComponent(workspaceId)}`,
    return_url: `${base}/app/integrations?stripe=return`,
    type: "account_onboarding",
  });

  return { url: link.url, accountId };
}

export async function disconnectStripeConnect(workspaceId: string): Promise<void> {
  await upsertMerchantConnection(workspaceId, "STRIPE", {
    status: "disabled",
    disconnectedAt: new Date(),
    chargesEnabled: false,
    payoutsEnabled: false,
    onboardingComplete: false,
    lastError: null,
  });
}
