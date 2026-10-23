import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { isFeatureSupported } from "@/lib/crm/feature-matrix";
import { listConnections } from "@/lib/integrations/connections";
import { listCrmImportSources } from "@/lib/server/phone/power-dialer/crm-list-import";

const CRM_OPS = ["import_contacts", "log_call", "log_disposition", "create_task", "sync_lists"] as const;

function supportedOpsFor(provider: string) {
  return CRM_OPS.filter((op) => {
    if (op === "import_contacts" || op === "sync_lists") return isFeatureSupported(provider, "contacts");
    if (op === "log_call" || op === "log_disposition") return isFeatureSupported(provider, "calls");
    if (op === "create_task") return isFeatureSupported(provider, "tasks");
    return false;
  });
}
import {
  getPowerDialerProviderSyncSettings,
  parseProviderParam,
  updatePowerDialerProviderSyncSettings,
} from "@/lib/server/phone/power-dialer/integration-settings";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: raw } = await ctx.params;
    const provider = parseProviderParam(raw);
    const workspaceId = await resolveWorkspaceId();
    const connections = await listConnections(workspaceId);
    const conn = connections.find((c) => c.provider === provider);
    const connected = conn?.status === "connected" || conn?.status === "syncing";
    const settings = await getPowerDialerProviderSyncSettings(workspaceId, provider);
    return NextResponse.json({
      data: {
        provider,
        connected,
        connection: {
          status: conn?.status ?? "disconnected",
          lastSyncAt:
            conn?.lastSyncAt instanceof Date
              ? conn.lastSyncAt.toISOString()
              : typeof conn?.lastSyncAt === "string"
                ? conn.lastSyncAt
                : null,
        },
        settings,
        importSources: listCrmImportSources(provider),
        oauthStartUrl: `/api/crm/oauth/start?provider=${provider}`,
        supportedOperations: supportedOpsFor(provider),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { provider: raw } = await ctx.params;
    const provider = parseProviderParam(raw);
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await updatePowerDialerProviderSyncSettings(workspaceId, provider, {
      logCalls: typeof body.logCalls === "boolean" ? body.logCalls : undefined,
      logDispositions: typeof body.logDispositions === "boolean" ? body.logDispositions : undefined,
      logNotes: typeof body.logNotes === "boolean" ? body.logNotes : undefined,
      createFollowUpTasks:
        typeof body.createFollowUpTasks === "boolean" ? body.createFollowUpTasks : undefined,
      listSourceId: typeof body.listSourceId === "string" ? body.listSourceId : undefined,
      fieldMappings:
        body.fieldMappings && typeof body.fieldMappings === "object"
          ? (body.fieldMappings as Record<string, string>)
          : undefined,
    });
    return NextResponse.json({ data: settings });
  } catch (err) {
    return jsonError(err, 400);
  }
}
