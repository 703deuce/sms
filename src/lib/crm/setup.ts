/**
 * Intelligent setup after OAuth — detect account metadata and pre-populate defaults.
 */

import { getPrisma } from "@/lib/db";
import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { isFeatureSupported } from "./feature-matrix";
import { fieldPresetsForProvider } from "./field-presets";
import { listFieldMappings, upsertFieldMapping } from "./mappings";
import { writeCrmAudit } from "./logging";
import { ensureFreshCrmToken } from "./oauth";
import { getConnector } from "./registry";
import { getCrmSyncPreferences, updateCrmSyncPreferences } from "./settings";
import { clampPreferencesToCapabilities } from "./capability";
import type { ConnectorContext } from "./connector";
import type { CrmPipeline, CrmProviderId, CrmUser } from "./types";

export type SetupDiscovery = {
  provider: CrmProviderId;
  accountName: string | null;
  accountId: string | null;
  users: CrmUser[];
  pipelines: CrmPipeline[];
  modules: string[];
  objectCounts: Record<string, number>;
  suggestedOwnerExternalId: string | null;
  suggestedPipelineId: string | null;
  suggestedStageId: string | null;
  fieldPresetsApplied: number;
  customFieldHints: Array<{ objectType: string; name: string; label: string }>;
  incomplete: string[];
};

async function ctx(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: await getCrmSyncPreferences(workspaceId, provider),
  };
}

export async function discoverCrmSetup(
  workspaceId: string,
  provider: CrmProviderId,
  opts?: { applyDefaults?: boolean; actorUserId?: string },
): Promise<SetupDiscovery> {
  const connector = getConnector(provider);
  const context = await ctx(workspaceId, provider);
  const incomplete: string[] = [];

  let users: CrmUser[] = [];
  let pipelines: CrmPipeline[] = [];
  const modules: string[] = ["contacts"];
  if (isFeatureSupported(provider, "companies")) modules.push("companies");
  if (isFeatureSupported(provider, "leads")) modules.push("leads");
  if (isFeatureSupported(provider, "deals")) modules.push("deals");
  if (isFeatureSupported(provider, "tasks")) modules.push("tasks");
  if (isFeatureSupported(provider, "calls")) modules.push("calls");
  if (isFeatureSupported(provider, "sms")) modules.push("sms");

  try {
    if (connector.listUsers) users = await connector.listUsers(context);
  } catch {
    incomplete.push("Could not load CRM users — set owner manually later");
  }

  try {
    if (connector.listPipelines && isFeatureSupported(provider, "pipelines")) {
      pipelines = await connector.listPipelines(context);
    } else if (!isFeatureSupported(provider, "pipelines")) {
      // ok
    } else {
      incomplete.push("Pipeline listing not available for this CRM");
    }
  } catch {
    incomplete.push("Could not load pipelines — configure later if needed");
  }

  let customFieldHints: SetupDiscovery["customFieldHints"] = [];
  try {
    if (connector.listFields) {
      customFieldHints = await connector.listFields(context);
    }
  } catch {
    incomplete.push("Custom field discovery unavailable — use presets");
  }

  const health = await connector.validateConnection(context).catch(() => null);
  const accountName = health?.externalAccountName || null;
  const accountId = health?.externalAccountId || null;

  const groups = await getPrisma().crmObjectMapping.groupBy({
    by: ["objectType"],
    where: { workspaceId, provider },
    _count: { _all: true },
  });
  const objectCounts: Record<string, number> = {};
  for (const g of groups) objectCounts[g.objectType] = g._count._all;

  const suggestedOwnerExternalId = users[0]?.externalId || null;
  const suggestedPipelineId = pipelines[0]?.id || null;
  const suggestedStageId = pipelines[0]?.stages?.[0]?.id || null;

  let fieldPresetsApplied = 0;
  if (opts?.applyDefaults) {
    const existing = await listFieldMappings(workspaceId, provider);
    const have = new Set(
      existing.map((e: { objectType: string; internalField: string }) =>
        `${e.objectType}:${e.internalField}`,
      ),
    );
    for (const preset of fieldPresetsForProvider(provider)) {
      if (have.has(`${preset.objectType}:${preset.internalField}`)) continue;
      // Skip lead presets when leads unsupported
      if (preset.objectType === "lead" && !isFeatureSupported(provider, "leads")) continue;
      await upsertFieldMapping({
        workspaceId,
        provider,
        objectType: preset.objectType,
        internalField: preset.internalField,
        externalField: preset.externalField,
        transform: preset.transform,
        direction: "bidirectional",
      });
      fieldPresetsApplied += 1;
    }

    const prefs = clampPreferencesToCapabilities(
      provider,
      await getCrmSyncPreferences(workspaceId, provider),
    );
    const patch: Partial<typeof prefs> = { ...prefs };
    if (!prefs.defaultOwnerExternalId && suggestedOwnerExternalId) {
      patch.defaultOwnerExternalId = suggestedOwnerExternalId;
    }
    if (!prefs.defaultPipelineId && suggestedPipelineId) {
      patch.defaultPipelineId = suggestedPipelineId;
    }
    if (!prefs.defaultStageId && suggestedStageId) {
      patch.defaultStageId = suggestedStageId;
    }
    await updateCrmSyncPreferences(workspaceId, provider, patch, opts.actorUserId);

    await upsertConnection({
      workspaceId,
      provider,
      connectedAccountName: accountName,
      externalId: accountId,
      config: {
        setupDiscovery: {
          at: new Date().toISOString(),
          userCount: users.length,
          pipelineCount: pipelines.length,
          modules,
        },
        onboarding: { step: "preferences", completed: false },
      },
      mergeConfig: true,
    });
  }

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "settings",
    action: "setup_discovered",
    message: `Detected ${users.length} user(s), ${pipelines.length} pipeline(s)`,
    actorUserId: opts?.actorUserId,
    detail: {
      accountName,
      userCount: users.length,
      pipelineCount: pipelines.length,
      fieldPresetsApplied,
    },
  });

  return {
    provider,
    accountName,
    accountId,
    users,
    pipelines,
    modules,
    objectCounts,
    suggestedOwnerExternalId,
    suggestedPipelineId,
    suggestedStageId,
    fieldPresetsApplied,
    customFieldHints,
    incomplete,
  };
}

export async function getOnboardingState(workspaceId: string, provider: CrmProviderId) {
  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.configJson || {}) as {
    onboarding?: { step?: string; completed?: boolean };
  };
  return {
    status: conn?.status || "disconnected",
    step: cfg.onboarding?.step || "connect",
    completed: Boolean(cfg.onboarding?.completed),
    accountName: conn?.connectedAccountName || null,
  };
}

export async function setOnboardingStep(
  workspaceId: string,
  provider: CrmProviderId,
  step: string,
  completed = false,
) {
  await upsertConnection({
    workspaceId,
    provider,
    config: { onboarding: { step, completed, updatedAt: new Date().toISOString() } },
    mergeConfig: true,
  });
}
