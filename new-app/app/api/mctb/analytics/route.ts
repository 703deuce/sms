import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadMctbAnalytics } from "@/lib/mctb/analytics";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics-range";

const VALID = new Set<MctbAnalyticsRange>(["7d", "30d", "90d"]);

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireSession();
    const raw = new URL(req.url).searchParams.get("range") || "30d";
    const range: MctbAnalyticsRange = VALID.has(raw as MctbAnalyticsRange)
      ? (raw as MctbAnalyticsRange)
      : "30d";
    const data = await loadMctbAnalytics(workspaceId, range);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "analytics_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
