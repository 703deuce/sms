import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import {
  DEFAULT_INTEGRATION_PREFERENCES,
  type ExternalProviderId,
  type IntegrationPreferences,
} from "./types";

export async function getIntegrationPreferences(
  workspaceId: string,
  provider: ExternalProviderId,
): Promise<IntegrationPreferences> {
  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  const prefs = (cfg.preferences || {}) as Partial<IntegrationPreferences>;
  return {
    ...DEFAULT_INTEGRATION_PREFERENCES,
    ...prefs,
    fieldMappings: {
      ...DEFAULT_INTEGRATION_PREFERENCES.fieldMappings,
      ...(prefs.fieldMappings || {}),
    },
    includedIds: prefs.includedIds || DEFAULT_INTEGRATION_PREFERENCES.includedIds,
    eventSubscriptions:
      prefs.eventSubscriptions || DEFAULT_INTEGRATION_PREFERENCES.eventSubscriptions,
    providerSettings: {
      ...DEFAULT_INTEGRATION_PREFERENCES.providerSettings,
      ...(prefs.providerSettings || {}),
    },
  };
}

export async function saveIntegrationPreferences(
  workspaceId: string,
  provider: ExternalProviderId,
  patch: Partial<IntegrationPreferences>,
) {
  const current = await getIntegrationPreferences(workspaceId, provider);
  const next = { ...current, ...patch };
  await upsertConnection({
    workspaceId,
    provider,
    config: { preferences: next },
    mergeConfig: true,
    ...(patch.paused != null
      ? { status: patch.paused ? "error" : "connected", syncStatus: patch.paused ? "idle" : undefined }
      : {}),
  });
  // Pause uses syncStatus/config — keep connection status connected when pausing.
  if (patch.paused === true) {
    await upsertConnection({
      workspaceId,
      provider,
      status: "connected",
      syncStatus: "idle",
      config: { preferences: next, paused: true },
      mergeConfig: true,
    });
  } else if (patch.paused === false) {
    await upsertConnection({
      workspaceId,
      provider,
      status: "connected",
      config: { preferences: next, paused: false },
      mergeConfig: true,
    });
  }
  return next;
}
