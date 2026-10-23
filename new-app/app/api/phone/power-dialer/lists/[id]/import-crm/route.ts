import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { isCrmProvider } from "@/lib/crm/registry";
import { importCrmListIntoCallingList } from "@/lib/server/phone/power-dialer/crm-list-import";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: listId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { provider?: string; sourceId?: string; maxRecords?: number };
    const provider = String(body.provider || "");
    if (!isCrmProvider(provider)) throw new Error("Invalid CRM provider");
    const result = await importCrmListIntoCallingList({
      workspaceId,
      provider,
      listId,
      sourceId: String(body.sourceId || "contacts"),
      maxRecords: body.maxRecords,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
