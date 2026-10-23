import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPowerDialerAnalytics } from "@/lib/server/phone/power-dialer/analytics-service";
import { getCampaignConversionSummary } from "@/lib/server/phone/power-dialer/analytics-conversion";
import { getPowerDialerUsageSnapshot } from "@/lib/server/phone/power-dialer/usage-limits";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import {
  analyticsRepFilter,
  requirePowerDialerScope,
} from "@/lib/server/phone/power-dialer/power-dialer-permissions";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const { role } = await requirePowerDialerScope(workspaceId, userId, "analytics_read");
    const repFilter = analyticsRepFilter(role, userId);
    const url = new URL(request.url);
    const range = url.searchParams.get("range");
    const r = range === "30d" || range === "90d" ? range : "7d";
    const from = new Date();
    const days = r === "90d" ? 90 : r === "30d" ? 30 : 7;
    from.setDate(from.getDate() - days);
    const [analytics, usage, conversions] = await Promise.all([
      getPowerDialerAnalytics(workspaceId, r, repFilter),
      getPowerDialerUsageSnapshot(workspaceId),
      getCampaignConversionSummary(workspaceId, from, repFilter),
    ]);
    return NextResponse.json({ data: { ...analytics, usage, conversions } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
