import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createVerifyCreditsCheckoutSession } from "@/lib/verify/verify-billing";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const productKey = String(body.productKey || "").trim();
    const returnPath = String(body.returnPath || "/verify/billing").trim();
    if (!productKey.startsWith("verify_")) {
      return jsonError(new Error("Invalid verify product key"), 400);
    }

    const origin = new URL(request.url).origin;
    const session = await createVerifyCreditsCheckoutSession({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      productKey,
      origin,
      returnPath,
    });
    return NextResponse.json({ data: session });
  } catch (err) {
    return jsonError(err);
  }
}
