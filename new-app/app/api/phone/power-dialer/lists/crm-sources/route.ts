import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { CRM_PROVIDER_IDS } from "@/lib/crm/registry";
import { listConnections } from "@/lib/integrations/connections";
import { listCrmImportSources } from "@/lib/server/phone/power-dialer/crm-list-import";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const connections = await listConnections(workspaceId);
    const connected = CRM_PROVIDER_IDS.filter((id) =>
      connections.some((c) => c.provider === id && (c.status === "connected" || c.status === "syncing")),
    );
    const sources = connected.map((provider) => ({
      provider,
      sources: listCrmImportSources(provider),
    }));
    return NextResponse.json({ data: { connected, sources } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
