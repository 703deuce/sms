import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getMerchantPaymentStatus } from "@/lib/merchant-payments/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getMerchantPaymentStatus(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
