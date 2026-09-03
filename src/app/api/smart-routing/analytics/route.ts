import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getRoutingAnalyticsSummary } from "@/lib/smart-routing/ai/analytics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rawDays = Number(new URL(request.url).searchParams.get("days") || "30");
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
    const data = await getRoutingAnalyticsSummary(auth.workspaceId, days);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
