import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getLiveDialerBoard } from "@/lib/server/phone/power-dialer/analytics-service";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "analytics_read");
    const board = await getLiveDialerBoard(workspaceId);
    return NextResponse.json({ data: board });
  } catch (err) {
    return jsonError(err, 403);
  }
}
