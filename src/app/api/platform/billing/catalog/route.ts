import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getPlatformBillingCatalog,
  listPlatformPurchasableProducts,
} from "@/lib/products/platform-billing-catalog";
import { getPlatformBillingSnapshot } from "@/lib/products/platform-subscriptions";
import { bundleMonthlyTotalCents } from "@/lib/products/platform-bundle-pricing";
import type { MctbTier, SmartRoutingTier } from "@/lib/products/platform-billing-catalog-definitions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const catalog = getPlatformBillingCatalog();
    const products = listPlatformPurchasableProducts();
    const snapshot = await getPlatformBillingSnapshot(auth.workspaceId);

    const mctbSub = snapshot.subscriptions.find(
      (s: { productFamily: string }) => s.productFamily === "mctb",
    );
    const srSub = snapshot.subscriptions.find(
      (s: { productFamily: string }) => s.productFamily === "smart_routing",
    );

    return NextResponse.json({
      data: {
        products,
        catalog,
        subscriptions: snapshot.subscriptions,
        dualDiscountActive: snapshot.dualDiscountActive,
        dualDiscountPercent: catalog.discounts.dualProduct.percentOff,
        bundlePreview:
          mctbSub && srSub
            ? bundleMonthlyTotalCents(
                mctbSub.tier as MctbTier,
                srSub.tier as SmartRoutingTier,
                true,
              )
            : null,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
