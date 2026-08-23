import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe/client";
import {
  grantsForPlatformProduct,
  resolvePlatformCheckoutPriceId,
} from "@/lib/products/platform-billing-catalog";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const stripe = getStripe();
    if (!stripe) return jsonError(new Error("Stripe is not configured"), 503);

    const body = await request.json();
    const productKey = String(body.productKey || "").trim();
    if (!productKey) return jsonError(new Error("productKey required"), 400);

    const priceId = await resolvePlatformCheckoutPriceId(productKey);
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?platform_checkout=success&product=${productKey}`,
      cancel_url: `${origin}/settings/billing?platform_checkout=cancel`,
      metadata: {
        workspaceId: auth.workspaceId,
        platformProductKey: productKey,
        userId: auth.session.userId,
      },
      subscription_data: {
        metadata: {
          workspaceId: auth.workspaceId,
          platformProductKey: productKey,
        },
      },
    });

  // Dev/local without webhook: grant on session create when STRIPE_PLATFORM_AUTO_GRANT=1
    if (process.env.STRIPE_PLATFORM_AUTO_GRANT === "1") {
      for (const feature of grantsForPlatformProduct(productKey)) {
        await grantWorkspaceProductFeature(auth.workspaceId, feature, "active");
      }
    }

    return NextResponse.json({ data: { url: session.url, sessionId: session.id } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
