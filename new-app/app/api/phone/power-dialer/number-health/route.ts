import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listPowerDialerNumberHealth } from "@/lib/server/phone/power-dialer/number-health-service";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "analytics_read");
    const data = await listPowerDialerNumberHealth(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
