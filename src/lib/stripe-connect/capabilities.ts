import "server-only";

import {
  getMerchantConnection,
  type ConnectionRecord,
} from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount } from "@/lib/merchant-payments/stripe-connect";

export type StripeTextToPayHealth =
  | "CONNECTED"
  | "STRIPE_CONNECTED_NOT_PAYMENT_READY"
  | "NEEDS_ATTENTION"
  | "DISCONNECTED";

export type StripeTextToPayCapabilities = {
  connected: boolean;
  health: StripeTextToPayHealth;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  cardPaymentsActive: boolean;
  requiredActions: string[];
  canCreateDirectCharge: boolean;
  canCreateCheckoutSession: boolean;
  canCreatePaymentLink: boolean;
  canCreateInvoice: boolean;
  canRefund: boolean;
  canCollectApplicationFee: boolean;
  liveModeReady: boolean;
  needsAttention: boolean;
  usesLegacyOAuthAccessToken: boolean;
  authMode: "platform_key_stripe_account_header";
  notes: string[];
};

function cardPaymentsActive(metadata: ConnectionRecord): boolean {
  const caps = (metadata.providerMetadata as { capabilities?: Record<string, string> } | null)
    ?.capabilities;
  if (!caps) return true; // unknown until refresh
  const status = caps.card_payments || caps.cardPayments;
  return status === "active" || status === "pending";
}

export async function getStripeTextToPayCapabilities(
  workspaceId: string,
): Promise<StripeTextToPayCapabilities> {
  const notes: string[] = [];
  const conn = await getMerchantConnection(workspaceId, "STRIPE");
  if (!conn?.merchantAccountId) {
    return {
      connected: false,
      health: "DISCONNECTED",
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      cardPaymentsActive: false,
      requiredActions: [],
      canCreateDirectCharge: false,
      canCreateCheckoutSession: false,
      canCreatePaymentLink: false,
      canCreateInvoice: false,
      canRefund: false,
      canCollectApplicationFee: false,
      liveModeReady: false,
      needsAttention: true,
      usesLegacyOAuthAccessToken: Boolean(conn?.accessTokenEnc),
      authMode: "platform_key_stripe_account_header",
      notes: ["Stripe Connect not linked — connect in Integrations → Payments"],
    };
  }

  const refreshed = await refreshStripeConnectAccount(workspaceId, conn);
  const requirements = (refreshed.providerMetadata as { requirements?: { currently_due?: string[]; past_due?: string[] } })
    ?.requirements;
  const requiredActions = [
    ...(requirements?.currently_due || []),
    ...(requirements?.past_due || []),
  ];
  const chargesEnabled = Boolean(refreshed.chargesEnabled);
  const cardActive = cardPaymentsActive(refreshed);
  const needsAttention = refreshed.status === "needs_attention" || requiredActions.length > 0;

  if (conn.accessTokenEnc) {
    notes.push(
      "Legacy OAuth access token stored but unused — API uses platform key + connected account ID (ST-AUTH-001)",
    );
  }

  let health: StripeTextToPayHealth = "CONNECTED";
  if (!chargesEnabled || !cardActive) health = "STRIPE_CONNECTED_NOT_PAYMENT_READY";
  else if (needsAttention) health = "NEEDS_ATTENTION";

  const canPay = chargesEnabled && cardActive && refreshed.merchantAccountId;

  return {
    connected: true,
    health,
    accountId: refreshed.merchantAccountId,
    chargesEnabled,
    payoutsEnabled: Boolean(refreshed.payoutsEnabled),
    cardPaymentsActive: cardActive,
    requiredActions,
    canCreateDirectCharge: Boolean(canPay),
    canCreateCheckoutSession: Boolean(canPay),
    canCreatePaymentLink: Boolean(canPay),
    canCreateInvoice: Boolean(canPay),
    canRefund: Boolean(canPay),
    canCollectApplicationFee: Boolean(canPay),
    liveModeReady: Boolean(canPay && !needsAttention),
    needsAttention,
    usesLegacyOAuthAccessToken: Boolean(conn.accessTokenEnc),
    authMode: "platform_key_stripe_account_header",
    notes,
  };
}
