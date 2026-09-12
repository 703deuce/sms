import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getStripeConnectionSummary } from "@/lib/payment-requests/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const stripe = await getStripeConnectionSummary(workspaceId);
    return NextResponse.json({ data: { stripe } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
