/**
 * Provider feature compatibility — never assume parity.
 * Unsupported features must be handled gracefully in UI and push paths.
 */

import type { CrmProviderId } from "./types";

export type FeatureSupport =
  | "read_write"
  | "read_only"
  | "write_only"
  | "unsupported"
  | "link_only"
  | "beta"
  | "subscription_dependent"
  | "fallback";

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
  | "bidirectional_sync"
  | "tags";

export type FeatureRow = {
  feature: ProviderFeature;
  label: string;
  support: FeatureSupport;
  notes?: string;
};

const MATRIX: Record<CrmProviderId, FeatureRow[]> = {
  salesforce: [
    { feature: "contacts", label: "Contacts", support: "beta", notes: "Create/update + email/phone match wired; sandbox proof pending" },
    { feature: "companies", label: "Companies (Accounts)", support: "beta", notes: "Import + upsert wired; sandbox proof pending" },
    { feature: "leads", label: "Leads", support: "beta", notes: "Import/upsert when enabled; sandbox proof pending" },
    { feature: "deals", label: "Deals (Opportunities)", support: "beta", notes: "Import when syncOpportunities enabled; sandbox proof pending" },
    { feature: "tasks", label: "Tasks", support: "beta", notes: "Create/update with idempotent mapping" },
    { feature: "notes", label: "Notes", support: "fallback", notes: "ContentNote + ContentDocumentLink; Task fallback if unavailable" },
    {
      feature: "calls",
      label: "Call logging",
      support: "beta",
      notes: "One Task (Call subtype) per Transovo call; recording/transcript/summary update same activity. Sandbox proof pending.",
    },
    {
      feature: "sms",
      label: "SMS logging",
      support: "beta",
      notes: "Task activity; MMS as media URL links. Sandbox proof pending.",
    },
    { feature: "activities", label: "Activities", support: "beta" },
    { feature: "recording_links", label: "Recording links", support: "link_only", notes: "URL in activity description; no binary upload" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "beta", notes: "Field mappings applied to create/update payloads" },
    { feature: "tags", label: "Tags / labels", support: "unsupported", notes: "No universal Salesforce Tags API; map tags to a text/multipicklist field instead" },
    { feature: "pipelines", label: "Pipelines", support: "read_only", notes: "Virtual Opportunity pipeline" },
    { feature: "stages", label: "Stages", support: "read_only", notes: "OpportunityStage / StageName picklist" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "beta", notes: "Generic webhook ingest + delete handling; Salesforce Change Data Capture not subscribed yet" },
    { feature: "incremental_sync", label: "Incremental sync", support: "beta", notes: "SOQL LastModifiedDate checkpoints" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "beta", notes: "Direction/pause/read-write gates in preferences; sandbox proof pending" },
  ],
  zoho: [
    { feature: "contacts", label: "Contacts", support: "beta", notes: "Create/update + email/phone match; sandbox proof pending" },
    { feature: "companies", label: "Companies (Accounts)", support: "beta" },
    { feature: "leads", label: "Leads", support: "beta" },
    { feature: "deals", label: "Deals", support: "beta" },
    { feature: "tasks", label: "Tasks", support: "beta" },
    { feature: "notes", label: "Notes", support: "beta" },
    {
      feature: "calls",
      label: "Call logging",
      support: "fallback",
      notes: "Native Calls module when available; Task fallback on plan/module errors. UI should state which model is used after sandbox validate.",
    },
    { feature: "sms", label: "SMS logging", support: "fallback", notes: "Logged as Task with MMS URLs" },
    { feature: "activities", label: "Activities", support: "beta" },
    { feature: "recording_links", label: "Recording links", support: "link_only" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "beta", notes: "Via field mappings + settings.fields.READ" },
    { feature: "tags", label: "Tags / labels", support: "beta", notes: "settings/tags when available; Bigin may differ" },
    { feature: "pipelines", label: "Pipelines", support: "read_only", notes: "Deal Pipeline field when available; Bigin uses Pipelines module" },
    { feature: "stages", label: "Stages", support: "read_only" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "beta", notes: "HTTP ingest + delete handling implemented; provider webhook registration is manual in Zoho admin (not auto-created)" },
    { feature: "incremental_sync", label: "Incremental sync", support: "beta", notes: "Modified_Time search criteria + checkpoints" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "beta" },
  ],
  pipedrive: [
    { feature: "contacts", label: "Contacts (Persons)", support: "beta", notes: "Create/update + email/phone match; sandbox proof pending" },
    { feature: "companies", label: "Companies (Organizations)", support: "beta" },
    { feature: "leads", label: "Leads", support: "unsupported", notes: "Native Leads inbox not synced; use Persons + Deals" },
    { feature: "deals", label: "Deals", support: "beta" },
    { feature: "tasks", label: "Tasks", support: "beta", notes: "Activities type=task; retries update mapped activity" },
    { feature: "notes", label: "Notes", support: "beta" },
    { feature: "calls", label: "Call logging", support: "beta", notes: "One activity type=call per Transovo call lifecycle" },
    { feature: "sms", label: "SMS logging", support: "beta", notes: "Activities type=sms; MMS as media URL links" },
    { feature: "activities", label: "Activities", support: "beta" },
    { feature: "recording_links", label: "Recording links", support: "link_only" },
    { feature: "transcript_links", label: "Transcript links", support: "link_only" },
    { feature: "custom_fields", label: "Custom fields", support: "beta", notes: "Via field mappings" },
    { feature: "tags", label: "Tags / labels", support: "beta", notes: "personLabels when available; outbound maps names via field mappings" },
    { feature: "pipelines", label: "Pipelines", support: "read_write" },
    { feature: "stages", label: "Stages", support: "read_only" },
    { feature: "owners", label: "Owners", support: "read_only" },
    { feature: "webhooks_inbound", label: "Inbound webhooks", support: "beta", notes: "Queue + delete handling; Pipedrive webhook registration pending" },
    { feature: "incremental_sync", label: "Incremental sync", support: "beta", notes: "Sorted update_time pages + checkpoints" },
    { feature: "bidirectional_sync", label: "Bidirectional sync", support: "beta" },
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

/** Customer-facing advertising should only use sandbox-proven rows. */
export function isSandboxProven(
  provider: CrmProviderId,
  feature: ProviderFeature,
): boolean {
  const support = featureSupport(provider, feature);
  return support === "read_write" || support === "read_only" || support === "write_only" || support === "link_only";
}

export function featureSupport(
  provider: CrmProviderId,
  feature: ProviderFeature,
): FeatureSupport {
  return MATRIX[provider].find((r) => r.feature === feature)?.support || "unsupported";
}
