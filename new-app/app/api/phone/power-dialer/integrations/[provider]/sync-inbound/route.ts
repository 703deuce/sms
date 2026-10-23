import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { parseProviderParam } from "@/lib/server/phone/power-dialer/integration-settings";
import { syncCrmContactsInbound } from "@/lib/server/phone/power-dialer/crm-inbound-sync";
import { importCrmListIntoCallingList } from "@/lib/server/phone/power-dialer/crm-list-import";

export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { provider: raw } = await ctx.params;
    const provider = parseProviderParam(raw);
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
      listId?: string;
      sourceId?: string;
    };
    if (body.mode === "list" && body.listId) {
      const result = await importCrmListIntoCallingList({
        workspaceId,
        provider,
        listId: body.listId,
        sourceId: body.sourceId || "contacts",
      });
      return NextResponse.json({ data: result });
    }
    const result = await syncCrmContactsInbound(workspaceId, provider);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
