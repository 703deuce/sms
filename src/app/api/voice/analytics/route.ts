import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceAnalytics, analyticsToCsv } from "@/lib/voice/analytics";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "view_analytics");
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 30);
    const data = await loadVoiceAnalytics(auth.workspaceId, days, {
      agentId: url.searchParams.get("agentId") || undefined,
      campaignId: url.searchParams.get("campaignId") || undefined,
      direction: url.searchParams.get("direction") || undefined,
      outcome: url.searchParams.get("outcome") || undefined,
      phoneNumberId: url.searchParams.get("phoneNumberId") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
