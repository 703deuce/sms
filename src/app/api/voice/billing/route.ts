import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceBillingDashboard } from "@/lib/voice/billing-dashboard";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "view_analytics");
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 30);
    const data = await loadVoiceBillingDashboard(auth.workspaceId, days);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
