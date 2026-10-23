import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { createCampaign, listCampaigns } from "@/lib/server/phone/power-dialer";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const viewerUserId = await resolveInternalUserId().catch(() => undefined);
    const data = await listCampaigns(workspaceId, { viewerUserId });
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
    const data = await createCampaign(workspaceId, {
      name: String(body.name || ""),
      description: typeof body.description === "string" ? body.description : undefined,
      listId: String(body.listId || ""),
      callerIdE164: String(body.callerIdE164 || body.callerId || ""),
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
      configJson: (body.configJson || body.config || {}) as Record<string, unknown>,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
