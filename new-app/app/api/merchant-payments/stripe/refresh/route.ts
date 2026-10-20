import { NextResponse } from "next/server";
import { getIntegrationAppUrl } from "@/lib/integrations/framework/app-url";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import {
  refreshStripeConnectAccount,
  startStripeConnectOnboarding,
} from "@/lib/merchant-payments/stripe-connect";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const base = getIntegrationAppUrl();
  if (!workspaceId) {
    return NextResponse.redirect(`${base}/app/integrations?stripe=error`);
  }

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (connection) {
    await refreshStripeConnectAccount(workspaceId, connection);
  }

  const { url } = await startStripeConnectOnboarding(workspaceId);
  return NextResponse.redirect(url);
}
