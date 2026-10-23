import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { listCampaignQueue, patchCampaignQueue } from "@/lib/server/phone/power-dialer/campaign-queue";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const data = await listCampaignQueue(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      reorder?: { contactId: string; queueSortOrder: number }[];
      setPriority?: { contactId: string; dialPriority: number }[];
      skipContactId?: string;
    };
    const data = await patchCampaignQueue(workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
