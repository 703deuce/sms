import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getOrCreateWorkspaceCrmSettings, patchWorkspaceCrmSettings } from "@/lib/server/crm/native/crm-settings";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getOrCreateWorkspaceCrmSettings(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    const data = await patchWorkspaceCrmSettings(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
