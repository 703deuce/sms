import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { changePlatformSubscriptionTier } from "@/lib/products/platform-subscriptions";
import type { AiTranscriptionTier, MctbTier, SmartRoutingTier } from "@/lib/products/platform-billing-catalog-definitions";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const productFamily = String(body.productFamily || "").trim();
    const tier = String(body.tier || "").trim();
    if (!productFamily || !tier) {
      return jsonError(new Error("productFamily and tier required"), 400);
    }
    if (productFamily !== "mctb" && productFamily !== "smart_routing" && productFamily !== "ai_transcription") {
      return jsonError(new Error("invalid productFamily"), 400);
    }

    await changePlatformSubscriptionTier({
      workspaceId: auth.workspaceId,
      productFamily,
      newTier: tier as MctbTier | SmartRoutingTier | AiTranscriptionTier,
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
