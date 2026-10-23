import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPowerDialerAnalytics } from "@/lib/server/phone/power-dialer/analytics-service";
import { getPowerDialerUsageSnapshot } from "@/lib/server/phone/power-dialer/usage-limits";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const range = url.searchParams.get("range");
    const r = range === "30d" || range === "90d" ? range : "7d";
    const [analytics, usage] = await Promise.all([
      getPowerDialerAnalytics(workspaceId, r),
      getPowerDialerUsageSnapshot(workspaceId),
    ]);
    return NextResponse.json({ data: { ...analytics, usage } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
