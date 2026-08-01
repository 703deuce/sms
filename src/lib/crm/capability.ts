/**
 * CRM Capability Matrix — single source for UI gating and docs.
 * Never assume feature parity; disable unsupported preferences in the product UI.
 */

import {
  featureSupport,
  getFeatureMatrix,
  isFeatureSupported,
  type FeatureRow,
  type FeatureSupport,
  type ProviderFeature,
} from "./feature-matrix";
import type { CrmProviderId, CrmSyncPreferences } from "./types";
import { CRM_PROVIDER_IDS } from "./registry";

export type CapabilityCell = {
  feature: ProviderFeature;
  label: string;
  support: FeatureSupport;
  notes?: string;
};

/** Cross-provider matrix rows for the product UI table. */
export const CAPABILITY_MATRIX_FEATURES: Array<{
  feature: ProviderFeature;
  label: string;
}> = [
  { feature: "contacts", label: "Contacts" },
  { feature: "companies", label: "Companies" },
  { feature: "leads", label: "Leads" },
  { feature: "deals", label: "Deals / Opportunities" },
  { feature: "calls", label: "Call Logging" },
  { feature: "sms", label: "SMS Logging" },
  { feature: "recording_links", label: "Recording Links" },
  { feature: "transcript_links", label: "Transcript Links" },
  { feature: "custom_fields", label: "Custom Field Mapping" },
  { feature: "pipelines", label: "Pipeline Mapping" },
  { feature: "stages", label: "Stage Mapping" },
  { feature: "owners", label: "Owner Mapping" },
  { feature: "tasks", label: "Tasks" },
  { feature: "notes", label: "Notes" },
  { feature: "activities", label: "Activities" },
];

export function getCapabilityMatrixTable(): Array<{
  feature: ProviderFeature;
  label: string;
  cells: Record<CrmProviderId, CapabilityCell>;
}> {
  return CAPABILITY_MATRIX_FEATURES.map(({ feature, label }) => {
    const cells = {} as Record<CrmProviderId, CapabilityCell>;
    for (const id of CRM_PROVIDER_IDS) {
      const row = getFeatureMatrix(id).find((r) => r.feature === feature);
      cells[id] = {
        feature,
        label,
        support: row?.support || "unsupported",
        notes: row?.notes,
      };
    }
    return { feature, label, cells };
  });
}

/** Map sync preference keys → capability feature used for enable/disable. */
export const PREFERENCE_FEATURE_GATE: Partial<
  Record<keyof CrmSyncPreferences, ProviderFeature>
> = {
  autoCreateContacts: "contacts",
  autoCreateLeads: "leads",
  autoCreateCompanies: "companies",
  syncCalls: "calls",
  syncSms: "sms",
  syncRecordings: "recording_links",
  syncTranscripts: "transcript_links",
  syncNotes: "notes",
  syncTasks: "tasks",
  syncOpportunities: "deals",
  syncVoicemail: "calls",
  syncAiSummary: "calls",
  syncActivities: "activities",
  defaultOwnerExternalId: "owners",
  defaultPipelineId: "pipelines",
  defaultStageId: "stages",
};

export function isPreferenceSupported(
  provider: CrmProviderId,
  key: keyof CrmSyncPreferences,
): boolean {
  const feature = PREFERENCE_FEATURE_GATE[key];
  if (!feature) return true;
  return isFeatureSupported(provider, feature);
}

/** Disable unsupported prefs so saved settings stay coherent. */
export function clampPreferencesToCapabilities(
  provider: CrmProviderId,
  prefs: CrmSyncPreferences,
): CrmSyncPreferences {
  const next = { ...prefs };
  // Bigin is pipeline-centric: no native Leads module parity with Zoho CRM.
  if (provider === "zoho" && next.zohoProduct === "bigin") {
    next.autoCreateLeads = false;
  }
  if (!isFeatureSupported(provider, "leads") || (provider === "zoho" && next.zohoProduct === "bigin")) {
    next.autoCreateLeads = false;
  }
  if (!isFeatureSupported(provider, "deals")) next.syncOpportunities = false;
  if (!isFeatureSupported(provider, "pipelines")) {
    next.defaultPipelineId = null;
    next.defaultStageId = null;
  }
  if (!isFeatureSupported(provider, "calls")) {
    next.syncCalls = false;
    next.syncVoicemail = false;
  }
  if (!isFeatureSupported(provider, "sms")) next.syncSms = false;
  if (!isFeatureSupported(provider, "recording_links")) next.syncRecordings = false;
  if (!isFeatureSupported(provider, "transcript_links")) next.syncTranscripts = false;
  if (!isFeatureSupported(provider, "notes")) next.syncNotes = false;
  if (!isFeatureSupported(provider, "tasks")) next.syncTasks = false;
  if (!isFeatureSupported(provider, "activities")) next.syncActivities = false;
  return next;
}

export function supportLabel(support: FeatureSupport): string {
  switch (support) {
    case "read_write":
      return "Supported and sandbox-proven";
    case "read_only":
      return "Read only";
    case "write_only":
      return "Write only";
    case "link_only":
      return "Link only";
    case "beta":
      return "Beta (wired, sandbox proof pending)";
    case "subscription_dependent":
      return "Supported but subscription-dependent";
    case "fallback":
      return "Supported with fallback";
    default:
      return "Not supported";
  }
}

export function providerFeatureRows(provider: CrmProviderId): FeatureRow[] {
  return getFeatureMatrix(provider);
}

export { featureSupport, isFeatureSupported, getFeatureMatrix };
