import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { CRM_PROVIDER_IDS, providerEnvReady } from "@/lib/crm/registry";
import { isFeatureSupported } from "@/lib/crm/feature-matrix";
import { listConnections } from "@/lib/integrations/connections";
import { resolveWorkspaceId } from "@/lib/server/workspace";

const CRM_OPS = ["import_contacts", "log_call", "log_disposition", "create_task", "sync_lists"] as const;

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const connections = await listConnections(workspaceId);
    const crmConnections = connections.filter((c) =>
      (CRM_PROVIDER_IDS as readonly string[]).includes(c.provider),
    );

    const providers = CRM_PROVIDER_IDS.map((id) => {
      const conn = crmConnections.find((c) => c.provider === id);
      const supportedOps = CRM_OPS.filter((op) => {
        if (op === "import_contacts" || op === "sync_lists") {
          return isFeatureSupported(id, "contacts");
        }
        if (op === "log_call" || op === "log_disposition") {
          return isFeatureSupported(id, "calls");
        }
        if (op === "create_task") return isFeatureSupported(id, "tasks");
        return false;
      });
      return {
        provider: id,
        envConfigured: providerEnvReady(id),
        status: conn?.status || "disconnected",
        lastSyncAt: conn?.lastSyncAt,
        supportedOperations: supportedOps,
        connected: conn?.status === "connected" || conn?.status === "syncing",
      };
    });

    return NextResponse.json({ data: { providers, hasCrm: providers.some((p) => p.connected) } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
