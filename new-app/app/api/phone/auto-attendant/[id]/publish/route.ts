import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { publishAutoAttendantMenu } from "@/lib/server/phone/routing/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const menu = await publishAutoAttendantMenu(workspaceId, id);
    return NextResponse.json({ data: menu });
  } catch (err) {
    return jsonError(err, 400);
  }
}
