import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { listFieldMappings, upsertFieldMapping } from "@/lib/crm/mappings";
import type { CrmProviderId } from "@/lib/crm/types";
import { isCrmProvider } from "@/lib/crm/registry";

export type PowerDialerProviderSyncSettings = {
  logCalls: boolean;
  logDispositions: boolean;
  logNotes: boolean;
  createFollowUpTasks: boolean;
  listSourceId: string | null;
  fieldMappings: Record<string, string>;
};

const DEFAULTS: PowerDialerProviderSyncSettings = {
  logCalls: true,
  logDispositions: true,
  logNotes: true,
  createFollowUpTasks: true,
  listSourceId: "contacts",
  fieldMappings: {},
};

const KEY = "powerDialerSync";

export async function getPowerDialerProviderSyncSettings(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<PowerDialerProviderSyncSettings> {
  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.config || {}) as Record<string, unknown>;
  const stored = (cfg[KEY] || {}) as Partial<PowerDialerProviderSyncSettings>;
  const persistedMappings = await listFieldMappings(workspaceId, provider);
  const fieldMappings: Record<string, string> = { ...stored.fieldMappings };
  for (const m of persistedMappings) {
    if (m.objectType === "contact" && m.internalField && m.externalField) {
      fieldMappings[m.internalField] = m.externalField;
    }
  }
  return {
    ...DEFAULTS,
    ...stored,
    fieldMappings,
  };
}

export async function updatePowerDialerProviderSyncSettings(
  workspaceId: string,
  provider: CrmProviderId,
  patch: Partial<PowerDialerProviderSyncSettings>,
) {
  const current = await getPowerDialerProviderSyncSettings(workspaceId, provider);
  const next = { ...current, ...patch, fieldMappings: { ...current.fieldMappings, ...patch.fieldMappings } };
  await upsertConnection({
    workspaceId,
    provider,
    mergeConfig: true,
    config: { [KEY]: next },
  });
  if (patch.fieldMappings) {
    for (const [internalField, externalField] of Object.entries(patch.fieldMappings)) {
      if (!externalField.trim()) continue;
      await upsertFieldMapping({
        workspaceId,
        provider,
        objectType: "contact",
        internalField,
        externalField,
        direction: "bidirectional",
      });
    }
  }
  return next;
}

export function parseProviderParam(provider: string): CrmProviderId {
  if (!isCrmProvider(provider)) throw new Error("Unknown CRM provider");
  return provider;
}
