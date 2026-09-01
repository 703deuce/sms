import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadSmsAnalytics, parseSmsAnalyticsRange } from "@/lib/sms/analytics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const range = parseSmsAnalyticsRange(url.searchParams);
    const data = await loadSmsAnalytics(auth.workspaceId, range);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
