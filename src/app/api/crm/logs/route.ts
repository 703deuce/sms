import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listCrmAuditLogs, listCrmSyncRuns } from "@/lib/crm/logging";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") || undefined;
    const syncRunId = url.searchParams.get("syncRunId");
    const kind = url.searchParams.get("kind") || "runs";

    if (syncRunId) {
      const events = await getPrisma().crmSyncEvent.findMany({
        where: { workspaceId: auth.workspaceId, syncRunId },
        orderBy: { createdAt: "asc" },
        take: 500,
      });
      return NextResponse.json({ data: events });
    }

    if (kind === "audit") {
      const logs = await listCrmAuditLogs(auth.workspaceId, { provider, limit: 100 });
      return NextResponse.json({ data: logs });
    }

    const runs = await listCrmSyncRuns(auth.workspaceId, { provider, limit: 50 });
    return NextResponse.json({ data: runs });
  } catch (err) {
    return jsonError(err, 500);
  }
}
