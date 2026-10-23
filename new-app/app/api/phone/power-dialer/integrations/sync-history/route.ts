import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listCrmSyncRuns } from "@/lib/crm/logging";
import { listPowerDialerIntegrationSyncHistory } from "@/lib/server/phone/power-dialer/crm-sync-bridge";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const [pdLogs, crmRuns] = await Promise.all([
      listPowerDialerIntegrationSyncHistory(workspaceId, limit),
      listCrmSyncRuns(workspaceId, { limit }),
    ]);
    return NextResponse.json({
      data: {
        powerDialer: pdLogs,
        crmRuns,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
