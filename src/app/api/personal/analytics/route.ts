import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadPersonalAnalytics } from "@/lib/workspace/personal-data";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const numberId = url.searchParams.get("numberId") || undefined;
    const days = Number(url.searchParams.get("days") || "30");
    const periodDays = [7, 30, 90].includes(days) ? days : 30;

    const summary = await loadPersonalAnalytics(auth.workspaceId, periodDays, numberId);
    return NextResponse.json({ data: summary });
  } catch (err) {
    return jsonError(err, 500);
  }
}
