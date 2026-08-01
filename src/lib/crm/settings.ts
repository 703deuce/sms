import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { DEFAULT_SYNC_PREFERENCES, type CrmProviderId, type CrmSyncPreferences } from "./types";
import { writeCrmAudit } from "./logging";

const SETTINGS_KEY = "crmSyncPreferences";

export async function getCrmSyncPreferences(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<CrmSyncPreferences> {
  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  const stored = (cfg[SETTINGS_KEY] || {}) as Partial<CrmSyncPreferences>;
  return { ...DEFAULT_SYNC_PREFERENCES, ...stored };
}

export async function updateCrmSyncPreferences(
  workspaceId: string,
  provider: CrmProviderId,
  patch: Partial<CrmSyncPreferences>,
  actorUserId?: string,
) {
  const current = await getCrmSyncPreferences(workspaceId, provider);
  const next = { ...current, ...patch };
  await upsertConnection({
    workspaceId,
    provider,
    config: { [SETTINGS_KEY]: next },
    mergeConfig: true,
  });
  await writeCrmAudit({
    workspaceId,
    provider,
    category: "settings",
    action: "preferences_updated",
    message: "CRM sync preferences updated",
    detail: patch as Record<string, unknown>,
    actorUserId,
  });
  return next;
}

export function connectionUiState(status: string | null | undefined): string {
  switch (status) {
    case "connected":
      return "connected";
    case "pending_oauth":
      return "pending_oauth";
    case "needs_reauth":
      return "needs_reauth";
    case "syncing":
      return "syncing";
    case "error":
      return "error";
    default:
      return "disconnected";
  }
}
