import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount } from "@/lib/merchant-payments/stripe-connect";
import { getMerchantPaymentStatus } from "@/lib/merchant-payments/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const stripeConnection = await getMerchantConnection(auth.workspaceId, "STRIPE");
    if (stripeConnection?.merchantAccountId) {
      await refreshStripeConnectAccount(auth.workspaceId, stripeConnection);
    }

    const data = await getMerchantPaymentStatus(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
