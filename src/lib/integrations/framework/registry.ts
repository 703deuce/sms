import type { ExternalIntegrationAdapter } from "./adapter";
import { activecampaignAdapter } from "../adapters/activecampaign";
import { calendlyAdapter } from "../adapters/calendly";
import { closeAdapter } from "../adapters/close";
import { freshdeskAdapter } from "../adapters/freshdesk";
import { highlevelAdapter } from "../adapters/highlevel";
import { jotformAdapter } from "../adapters/jotform";
import { klaviyoAdapter } from "../adapters/klaviyo";
import { mailchimpAdapter } from "../adapters/mailchimp";
import { typeformAdapter } from "../adapters/typeform";
import { woocommerceAdapter } from "../adapters/woocommerce";
import type { ExternalProviderId } from "./types";
import { isExternalProvider as catalogIsExternal } from "./catalog";

const ADAPTERS: Record<ExternalProviderId, ExternalIntegrationAdapter> = {
  calendly: calendlyAdapter,
  activecampaign: activecampaignAdapter,
  mailchimp: mailchimpAdapter,
  highlevel: highlevelAdapter,
  woocommerce: woocommerceAdapter,
  typeform: typeformAdapter,
  jotform: jotformAdapter,
  close: closeAdapter,
  freshdesk: freshdeskAdapter,
  klaviyo: klaviyoAdapter,
};

export function isExternalProvider(id: string): id is ExternalProviderId {
  return catalogIsExternal(id);
}

export function getAdapter(provider: ExternalProviderId): ExternalIntegrationAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`No adapter registered for ${provider}`);
  return adapter;
}

export function listAdapters(): ExternalIntegrationAdapter[] {
  return Object.values(ADAPTERS);
}

export function getCapabilityMatrix() {
  return listAdapters().map((a) => ({
    id: a.id,
    displayName: a.displayName,
    authKind: a.authKind,
    capabilities: a.capabilities,
    credentialFields: a.credentialFields || [],
    oauth: a.oauth
      ? {
          clientIdEnv: a.oauth.clientIdEnv,
          clientSecretEnv: a.oauth.clientSecretEnv,
          scopes: a.oauth.scopes,
          authorizationUrl: a.oauth.authorizationUrl,
        }
      : null,
  }));
}
