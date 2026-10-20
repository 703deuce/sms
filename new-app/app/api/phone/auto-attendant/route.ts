import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { createAutoAttendantMenu, listAutoAttendantMenus } from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listAutoAttendantMenus(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || "Phone menu");
    const menu = await createAutoAttendantMenu(workspaceId, name);
    return NextResponse.json({ data: menu });
  } catch (err) {
    return jsonError(err, 400);
  }
}
