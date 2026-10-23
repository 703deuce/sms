import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { rerunCampaign } from "@/lib/server/phone/power-dialer/campaign-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json().catch(() => ({}))) as { includeCompletedContacts?: boolean };
    const data = await rerunCampaign(workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
