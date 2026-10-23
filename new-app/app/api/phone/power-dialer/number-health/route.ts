import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listPowerDialerNumberHealth } from "@/lib/server/phone/power-dialer/number-health-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listPowerDialerNumberHealth(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
