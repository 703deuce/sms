import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadVoiceAnalytics, analyticsToCsv } from "@/lib/voice/analytics";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "view_analytics");
    const days = Number(new URL(request.url).searchParams.get("days") || 30);
    const data = await loadVoiceAnalytics(auth.workspaceId, days);
    const csv = analyticsToCsv(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="voice-analytics-${days}d.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
