import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { checkCrmEnvironment } from "@/lib/crm/env-check";
import { listConnectors, providerEnvReady } from "@/lib/crm/registry";
import { connectionUiState, getCrmSyncPreferences } from "@/lib/crm/settings";
import { listCrmSyncRuns } from "@/lib/crm/logging";
import { scopeDocumentation } from "@/lib/crm/scopes";
import type { CrmProviderId } from "@/lib/crm/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const rows = await getPrisma().integrationConnection.findMany({
      where: { workspaceId: auth.workspaceId },
    });
    const byProvider = new Map(rows.map((c: { provider: string }) => [c.provider, c]));

    const providers = await Promise.all(
      listConnectors().map(async (c) => {
        const conn = byProvider.get(c.id) as
          | {
              status: string;
              syncStatus?: string | null;
              lastSyncAt?: Date | null;
              lastFailedSyncAt?: Date | null;
              lastError?: string | null;
              externalId?: string | null;
              connectedAccountName?: string | null;
              configJson?: unknown;
            }
          | undefined;
        const prefs = conn
          ? await getCrmSyncPreferences(auth.workspaceId, c.id as CrmProviderId)
          : null;
        const runs = await listCrmSyncRuns(auth.workspaceId, { provider: c.id, limit: 1 });
        const lastRun = runs[0] || null;
        const cfg = (conn?.configJson || {}) as Record<string, unknown>;
        // Presence-only — never secret values. Shows whether Coolify vars reached THIS web process.
        const env = checkCrmEnvironment(c.id as CrmProviderId);
        const providerEnv = env.providers[0];
        const envItems = env.items.map((i) => ({
          key: i.key,
          ok: i.ok,
          required: i.required,
          message: i.message,
        }));
        return {
          id: c.id,
          name: c.displayName,
          envConfigured: providerEnvReady(c.id),
          oauthReady: providerEnv?.oauthReady ?? false,
          missingEnv: providerEnv?.missing || [],
          callbackUrl: providerEnv?.callbackUrl || env.callbackUrls[c.id as CrmProviderId],
          envItems,
          status: connectionUiState(conn?.status),
          syncStatus: conn?.syncStatus || "idle",
          lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
          lastFailedSyncAt: conn?.lastFailedSyncAt?.toISOString() || null,
          lastError:
            conn?.lastError ||
            (cfg.lastOAuthError as string | undefined) ||
            lastRun?.lastError ||
            null,
          lastRunStatus: lastRun?.status || null,
          externalId: conn?.externalId || null,
          connectedAccountName: conn?.connectedAccountName || null,
          preferences: prefs,
          oauthScopes: c.oauth.scopes,
          scopeDocs: scopeDocumentation(c.id as CrmProviderId),
        };
      }),
    );

    return NextResponse.json({ data: providers });
  } catch (err) {
    return jsonError(err, 500);
  }
}
