import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { queryAfterHoursAnalytics } from "@/lib/voice-v3/post-call/analytics-query";

function parseRange(dateRange: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (dateRange === "today") {
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (dateRange === "30d") {
    from.setDate(from.getDate() - 30);
    return { from, to };
  }
  from.setDate(from.getDate() - 7);
  return { from, to };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const dateRange = (url.searchParams.get("dateRange") || "7d").toLowerCase();
    const { from, to } = parseRange(dateRange);
    const data = await queryAfterHoursAnalytics({
      workspaceId: auth.workspaceId,
      from,
      to,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
