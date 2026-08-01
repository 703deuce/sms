/**
 * Provider feature compatibility — never assume parity.
 * Unsupported features must be handled gracefully in UI and push paths.
 */

import type { CrmProviderId } from "./types";

export type FeatureSupport = "read_write" | "read_only" | "write_only" | "unsupported" | "link_only";

export type ProviderFeature =
  | "contacts"
  | "companies"
  | "leads"
  | "deals"
  | "tasks"
  | "notes"
  | "calls"
  | "sms"
  | "activities"
  | "recording_links"
  | "transcript_links"
  | "custom_fields"
  | "pipelines"
  | "stages"
  | "owners"
  | "webhooks_inbound"
  | "incremental_sync"
  | "bidirectional_sync";

export type FeatureRow = {
  feature: ProviderFeature;
  label: string;
  support: FeatureSupport;
  notes?: string;
};

const MATRIX: Record<CrmProviderId, FeatureRow[]> = {
  salesforce: [
    { feature: "contacts", label: "Contacts", support: "read_write" },
    { feature: "companies", label: "Companies (Accounts)", support: "read_write" },
    { feature: "leads", label: "Leads", support: "read_write" },
    { feature: "deals", label: "Deals (Opportunities)", support: "read_write" },
    { feature: "tasks", label: "Tasks", support: "read_write" },
    { feature: "notes", label: "Notes", support: "read_write", notes: "Falls back to Task if ContentNote unavailable" },
    { feature: "calls", label: "Call logging", support: "read_write", notes: "Logged as completed Task (Call subtype)" },
    { feature: "sms", label: "SMS logging", support: "read_write", notes: "Logged as Task activity" },
    { feature: "activities", label: "Activities", support: "read_write" },
    { feature: "recording_links", label: "Recording links", support: "link_only", notes: "URL in activity description; no binary upload" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "read_write", notes: "Via field mappings" },
    { feature: "pipelines", label: "Pipelines", support: "read_only", notes: "Virtual Opportunity pipeline" },
    { feature: "stages", label: "Stages", support: "read_only", notes: "OpportunityStage / StageName picklist" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "unsupported", notes: "Use outbound Transovo events + optional Salesforce Flow later" },
    { feature: "incremental_sync", label: "Incremental sync", support: "read_write" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "read_write", notes: "Direction controlled in preferences" },
  ],
  zoho: [
    { feature: "contacts", label: "Contacts", support: "read_write" },
    { feature: "companies", label: "Companies (Accounts)", support: "read_write" },
    { feature: "leads", label: "Leads", support: "read_write" },
    { feature: "deals", label: "Deals", support: "read_write" },
    { feature: "tasks", label: "Tasks", support: "read_write" },
    { feature: "notes", label: "Notes", support: "read_write" },
    { feature: "calls", label: "Call logging", support: "read_write", notes: "Calls module + Task fallback" },
    { feature: "sms", label: "SMS logging", support: "read_write", notes: "Logged as Task" },
    { feature: "activities", label: "Activities", support: "read_write" },
    { feature: "recording_links", label: "Recording links", support: "link_only" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "read_write", notes: "Via field mappings + settings.fields.READ" },
    { feature: "pipelines", label: "Pipelines", support: "read_only", notes: "Deal Pipeline field when available" },
    { feature: "stages", label: "Stages", support: "read_only" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "unsupported", notes: "Queued table ready; Zoho notification channel not wired" },
    { feature: "incremental_sync", label: "Incremental sync", support: "read_write" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "read_write" },
  ],
  pipedrive: [
    { feature: "contacts", label: "Contacts (Persons)", support: "read_write" },
    { feature: "companies", label: "Companies (Organizations)", support: "read_write" },
    { feature: "leads", label: "Leads", support: "unsupported", notes: "Use Persons + Deals; Leads inbox not synced" },
    { feature: "deals", label: "Deals", support: "read_write" },
    { feature: "tasks", label: "Tasks", support: "read_write", notes: "Activities type=task" },
    { feature: "notes", label: "Notes", support: "read_write" },
    { feature: "calls", label: "Call logging", support: "read_write", notes: "Activities type=call" },
    { feature: "sms", label: "SMS logging", support: "read_write", notes: "Activities type=sms" },
    { feature: "activities", label: "Activities", support: "read_write" },
    { feature: "recording_links", label: "Recording links", support: "link_only" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "read_write", notes: "Via field mappings" },
    { feature: "pipelines", label: "Pipelines", support: "read_write" },
    { feature: "stages", label: "Stages", support: "read_only" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "unsupported", notes: "Queue table ready; Pipedrive webhooks not wired" },
    { feature: "incremental_sync", label: "Incremental sync", support: "read_write" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "read_write" },
  ],
};

export function getFeatureMatrix(provider: CrmProviderId): FeatureRow[] {
  return MATRIX[provider];
}

export function isFeatureSupported(
  provider: CrmProviderId,
  feature: ProviderFeature,
): boolean {
  const row = MATRIX[provider].find((r) => r.feature === feature);
  return Boolean(row && row.support !== "unsupported");
}

export function featureSupport(
  provider: CrmProviderId,
  feature: ProviderFeature,
): FeatureSupport {
  return MATRIX[provider].find((r) => r.feature === feature)?.support || "unsupported";
}
