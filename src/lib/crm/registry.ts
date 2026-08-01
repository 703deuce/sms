import type { CrmConnector } from "./connector";
import { salesforceConnector } from "./adapters/salesforce";
import { zohoConnector } from "./adapters/zoho";
import { pipedriveConnector } from "./adapters/pipedrive";
import { defineCrmProvider } from "./sdk";
import type { CrmProviderId } from "./types";

const CONNECTORS: Record<CrmProviderId, CrmConnector> = {
  salesforce: defineCrmProvider({ adapter: salesforceConnector }),
  zoho: defineCrmProvider({ adapter: zohoConnector }),
  pipedrive: defineCrmProvider({ adapter: pipedriveConnector }),
};

export const CRM_PROVIDER_IDS: CrmProviderId[] = ["salesforce", "zoho", "pipedrive"];

export function isCrmProvider(value: string): value is CrmProviderId {
  return CRM_PROVIDER_IDS.includes(value as CrmProviderId);
}

export function getConnector(provider: CrmProviderId): CrmConnector {
  const c = CONNECTORS[provider];
  if (!c) throw new Error(`Unknown CRM provider: ${provider}`);
  return c;
}

export function listConnectors(): CrmConnector[] {
  return CRM_PROVIDER_IDS.map((id) => CONNECTORS[id]);
}

export function providerEnvReady(provider: CrmProviderId): boolean {
  const c = getConnector(provider);
  return Boolean(
    process.env[c.oauth.clientIdEnv]?.trim() && process.env[c.oauth.clientSecretEnv]?.trim(),
  );
}
