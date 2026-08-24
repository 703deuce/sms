import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createPlatformCheckoutSession } from "@/lib/products/platform-subscriptions";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { grantsForPlatformProduct } from "@/lib/products/platform-billing-catalog";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const productKey = String(body.productKey || "").trim();
    const nextProductKey = String(body.nextProductKey || "").trim() || undefined;
    if (!productKey) return jsonError(new Error("productKey required"), 400);

    const origin = new URL(request.url).origin;
    const session = await createPlatformCheckoutSession({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      userEmail: auth.session.email || "",
      productKey,
      origin,
      nextProductKey,
    });

    if (process.env.STRIPE_PLATFORM_AUTO_GRANT === "1") {
      for (const feature of grantsForPlatformProduct(productKey)) {
        await grantWorkspaceProductFeature(auth.workspaceId, feature, "active");
      }
    }

    return NextResponse.json({ data: { url: session.url, sessionId: session.sessionId } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
