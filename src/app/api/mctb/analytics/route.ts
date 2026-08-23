import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadMctbAnalytics, type MctbAnalyticsRange } from "@/lib/mctb/analytics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const range = (new URL(request.url).searchParams.get("range") || "30d") as MctbAnalyticsRange;
    const data = await loadMctbAnalytics(auth.workspaceId, range);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
