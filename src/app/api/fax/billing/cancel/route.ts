import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { cancelFaxSubscriptionAtPeriodEnd } from "@/lib/fax/fax-subscription";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await cancelFaxSubscriptionAtPeriodEnd(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
