import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { disconnectStripeConnect } from "@/lib/merchant-payments/stripe-connect";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await disconnectStripeConnect(auth.workspaceId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
