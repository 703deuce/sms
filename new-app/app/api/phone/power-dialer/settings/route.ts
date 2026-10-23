import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  getPowerDialerSettings,
  updatePowerDialerSettings,
} from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import type { PowerDialerWorkspaceSettings } from "@/lib/products/power-dialer";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getPowerDialerSettings(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Partial<PowerDialerWorkspaceSettings>;
    const data = await updatePowerDialerSettings(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
