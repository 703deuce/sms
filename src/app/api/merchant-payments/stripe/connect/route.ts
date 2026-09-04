import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { startStripeConnectOnboarding, isStripeConnectPlatformConfigured } from "@/lib/merchant-payments/stripe-connect";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!isStripeConnectPlatformConfigured()) {
      return NextResponse.json(
        { error: "Stripe platform is not configured. Set STRIPE_SECRET_KEY." },
        { status: 503 },
      );
    }
    const { url } = await startStripeConnectOnboarding(auth.workspaceId);
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
