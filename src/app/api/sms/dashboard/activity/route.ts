import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadSmsDashboardActivityForWorkspace } from "@/lib/sms/dashboard-metrics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const rawDays = Number(url.searchParams.get("days") || "30");
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
    const series = await loadSmsDashboardActivityForWorkspace(auth.workspaceId, days);
    return NextResponse.json({ data: { days, series } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
