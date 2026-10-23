import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { listConnections } from "@/lib/integrations/connections";
import { listCrmImportSources } from "@/lib/server/phone/power-dialer/crm-list-import";
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
    const settings = await getPowerDialerProviderSyncSettings(workspaceId, provider);
    return NextResponse.json({
      data: {
        provider,
        connection: conn,
        settings,
        importSources: listCrmImportSources(provider),
        oauthStartUrl: `/api/crm/oauth/start?provider=${provider}`,
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
