import type { CertProviderId, IntegrationProviderKind, ProviderCertBucket } from "./types";

export type ProviderCatalogEntry = {
  id: CertProviderId;
  displayName: string;
  kind: IntegrationProviderKind;
  bucket: ProviderCertBucket;
};

export const PROVIDER_CATALOG: Record<CertProviderId, ProviderCatalogEntry> = {
  pipedrive: {
    id: "pipedrive",
    displayName: "Pipedrive",
    kind: "crm",
    bucket: "connected_live_account",
  },
  calendly: {
    id: "calendly",
    displayName: "Calendly",
    kind: "native",
    bucket: "connected_live_account",
  },
  zoho: {
    id: "zoho",
    displayName: "Zoho CRM",
    kind: "crm",
    bucket: "connected_live_account",
  },
  salesforce: {
    id: "salesforce",
    displayName: "Salesforce",
    kind: "crm",
    bucket: "sandbox_or_dev_account",
  },
  jotform: {
    id: "jotform",
    displayName: "JotForm",
    kind: "native",
    bucket: "connected_live_account",
  },
};

export function isCertProviderId(id: string): id is CertProviderId {
  return id in PROVIDER_CATALOG;
}
