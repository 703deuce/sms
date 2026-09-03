import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadMctbAnalytics, type MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

const VALID_RANGES = new Set<MctbAnalyticsRange>(["7d", "30d", "90d"]);

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const raw = new URL(request.url).searchParams.get("range") || "30d";
    const range: MctbAnalyticsRange = VALID_RANGES.has(raw as MctbAnalyticsRange)
      ? (raw as MctbAnalyticsRange)
      : "30d";
    traceMctbDebug("analytics", "get_start", { workspaceId: auth.workspaceId, range });
    const data = await loadMctbAnalytics(auth.workspaceId, range);
    traceMctbDebug("analytics", "get_complete", {
      workspaceId: auth.workspaceId,
      range,
      totalMissed: data.totalMissed,
      textsSent: data.textsSent,
    });
    return NextResponse.json({ data });
  } catch (err) {
    traceMctbDebugError("analytics", "get_failed", err);
    return jsonError(err);
  }
}
