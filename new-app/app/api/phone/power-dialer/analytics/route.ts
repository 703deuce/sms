import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPowerDialerAnalytics } from "@/lib/server/phone/power-dialer/analytics-service";
import { getCampaignConversionSummary } from "@/lib/server/phone/power-dialer/analytics-conversion";
import { getPowerDialerUsageSnapshot } from "@/lib/server/phone/power-dialer/usage-limits";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  analyticsRepFilter,
  requirePowerDialerScope,
} from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import { logImpersonatedPowerDialerAction } from "@/lib/server/phone/power-dialer/impersonation";
import { resolvePowerDialerUserIds } from "@/lib/server/phone/power-dialer/session-user";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { actorUserId, effectiveUserId, impersonationSessionId } =
      await resolvePowerDialerUserIds(workspaceId);
    const { role } = await requirePowerDialerScope(workspaceId, actorUserId, "analytics_read");
    let repFilter = analyticsRepFilter(role, actorUserId);
    if (impersonationSessionId) {
      repFilter = effectiveUserId;
      await logImpersonatedPowerDialerAction({
        workspaceId,
        actorUserId,
        impersonationSessionId,
        impersonatedUserId: effectiveUserId,
        action: "impersonation_analytics_read",
        detail: { range: new URL(request.url).searchParams.get("range") },
      });
    }
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
