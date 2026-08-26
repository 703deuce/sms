import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createMassTextingCheckoutSession } from "@/lib/mass-texting/stripe-checkout";
import type { MassTextCheckoutKey } from "@/lib/mass-texting/pricing";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      productKey?: MassTextCheckoutKey;
      successUrl?: string;
      cancelUrl?: string;
    };
    if (!body.productKey) {
      return NextResponse.json({ error: "productKey required" }, { status: 400 });
    }
    const session = await createMassTextingCheckoutSession({
      workspaceId: auth.workspaceId,
      productKey: body.productKey,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
    return NextResponse.json({ data: session });
  } catch (err) {
    return jsonError(err, 400);
  }
}
