import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listConnections } from "@/lib/integrations/connections";
import { listConnectors, providerEnvReady } from "@/lib/crm/registry";
import { connectionUiState, getCrmSyncPreferences } from "@/lib/crm/settings";
import { listCrmSyncRuns } from "@/lib/crm/logging";
import type { CrmProviderId } from "@/lib/crm/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const connections = await listConnections(auth.workspaceId);
    const byProvider = new Map(connections.map((c) => [c.provider, c]));

    const providers = await Promise.all(
      listConnectors().map(async (c) => {
        const conn = byProvider.get(c.id);
        const prefs = conn
          ? await getCrmSyncPreferences(auth.workspaceId, c.id as CrmProviderId)
          : null;
        const runs = await listCrmSyncRuns(auth.workspaceId, { provider: c.id, limit: 1 });
        const lastRun = runs[0] || null;
        return {
          id: c.id,
          name: c.displayName,
          envConfigured: providerEnvReady(c.id),
          status: connectionUiState(conn?.status),
          lastSyncAt: conn?.lastSyncAt || null,
          lastError:
            (conn?.config?.lastOAuthError as string | undefined) ||
            lastRun?.lastError ||
            null,
          lastRunStatus: lastRun?.status || null,
          externalId: conn?.externalId || null,
          preferences: prefs,
          oauthScopes: c.oauth.scopes,
        };
      }),
    );

    return NextResponse.json({ data: providers });
  } catch (err) {
    return jsonError(err, 500);
  }
}
