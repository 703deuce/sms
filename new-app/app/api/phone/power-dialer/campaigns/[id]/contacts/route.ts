import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listCampaignContacts } from "@/lib/server/phone/power-dialer/campaign-contacts";
import type { EligibilityBucket } from "@/lib/server/phone/power-dialer/types";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 25)));
    const bucket = (url.searchParams.get("bucket") || "all") as EligibilityBucket | "all";
    const search = url.searchParams.get("q") || undefined;
    const data = await listCampaignContacts(workspaceId, id, { page, pageSize, bucket, search });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
