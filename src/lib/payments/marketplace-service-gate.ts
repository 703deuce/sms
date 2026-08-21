import { NextResponse } from "next/server";
import { isNumberTestPaymentMode } from "@/lib/payments/number-payment-provider";
import {
  assertActiveNumberServiceSubscription,
} from "@/lib/payments/number-service-subscription";
import type { MarketplaceServiceKey } from "@/lib/payments/stripe-marketplace-metadata";
import { isStripeConfigured } from "@/lib/stripe/client";

export async function requirePaidServiceSubscription(
  workspaceId: string,
  phoneNumberId: string,
  productKey: MarketplaceServiceKey,
) {
  if (isNumberTestPaymentMode() || !isStripeConfigured()) return null;
  const gate = await assertActiveNumberServiceSubscription({
    workspaceId,
    phoneNumberId,
    productKey,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, code: "subscription_required", productKey },
      { status: 402 },
    );
  }
  return null;
}

export function personalCallSettingsNeedsForwardingSubscription(
  settings: {
    forwardingEnabled?: boolean;
    incomingCallHandling?: string;
  } | undefined,
): boolean {
  if (!settings) return false;
  if (settings.forwardingEnabled) return true;
  return settings.incomingCallHandling === "forward";
}
