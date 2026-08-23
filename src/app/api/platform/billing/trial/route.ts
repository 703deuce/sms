import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  grantWorkspaceProductFeature,
  type TransovoProductFeature,
} from "@/lib/products/feature-entitlements";
import { grantsForPlatformProduct } from "@/lib/products/platform-billing-catalog";

const FEATURE_ALIASES: Record<string, TransovoProductFeature[]> = {
  mctb: ["mctb"],
  smart_routing: ["smart_routing"],
  visual_voicemail: ["visual_voicemail"],
  callback_requests: ["callback_requests"],
  bundle_mctb_sr: ["mctb", "smart_routing"],
};

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const productKey = String(body.productKey || body.feature || "").trim();
    if (!productKey) return jsonError(new Error("productKey required"), 400);

    const features =
      FEATURE_ALIASES[productKey] ??
      grantsForPlatformProduct(productKey);

    if (!features.length) {
      return jsonError(new Error(`Unknown product: ${productKey}`), 400);
    }

    for (const feature of features) {
      await grantWorkspaceProductFeature(auth.workspaceId, feature, "trial");
    }

    return NextResponse.json({
      ok: true,
      data: {
        productKey,
        granted: features,
        status: "trial",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
