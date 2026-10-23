import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getAttemptCallReview } from "@/lib/server/phone/power-dialer/analytics-service";
import {
  analyticsRepFilter,
  requirePowerDialerScope,
} from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import { assertPowerDialerRecordingAccess } from "@/lib/server/phone/power-dialer/recording-access";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const { role } = await requirePowerDialerScope(workspaceId, userId, "analytics_read");
    const review = await getAttemptCallReview(workspaceId, id);
    const repFilter = analyticsRepFilter(role, userId);
    if (repFilter && review.attempt.session.repUserId !== repFilter) {
      throw new Error("Permission denied: cannot view another rep's call review");
    }
    if (review.attempt.humanCall?.recordingUrl) {
      await assertPowerDialerRecordingAccess(workspaceId, userId);
    }
    return NextResponse.json({ data: review });
  } catch (err) {
    return jsonError(err, 403);
  }
}
