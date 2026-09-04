import { NextResponse } from "next/server";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount, startStripeConnectOnboarding } from "@/lib/merchant-payments/stripe-connect";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.redirect(new URL("/settings/payments?stripe=error", request.url));
  }

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (connection) {
    await refreshStripeConnectAccount(workspaceId, connection);
  }

  const { url } = await startStripeConnectOnboarding(workspaceId);
  return NextResponse.redirect(url);
}
