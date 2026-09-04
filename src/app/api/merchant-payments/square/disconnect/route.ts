import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { disconnectMerchantConnection } from "@/lib/merchant-payments/connection-store";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await disconnectMerchantConnection(auth.workspaceId, "SQUARE");
    return NextResponse.json({ data: { disconnected: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
