import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listCampaignTableRows } from "@/lib/server/phone/power-dialer/campaign-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const search = url.searchParams.get("q") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const data = await listCampaignTableRows(workspaceId, { search, status });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
