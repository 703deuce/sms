import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadMessagingAnalytics,
  parseAnalyticsRange,
} from "@/lib/analytics/messaging-analytics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const range = parseAnalyticsRange(url.searchParams);
    const data = await loadMessagingAnalytics(auth.workspaceId, range);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
