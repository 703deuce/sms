/**
 * Internal CRM Integration SDK.
 *
 * Adding a fourth CRM should only require implementing this surface and
 * registering the adapter — event bus, rules, rate limits, sync, UI, and
 * diagnostics already exist.
 */

import type { CrmConnector } from "./connector";
import type { CrmProviderId } from "./types";
import { getFeatureMatrix, type FeatureRow } from "./feature-matrix";
import { getProviderSubscription, type ProviderEventSubscription } from "./runtime/subscriptions";

/**
 * Minimal methods a new provider must implement.
 * Optional connector methods remain optional for progressive enhancement.
 */
export type CrmProviderSdk = Pick<
  CrmConnector,
  | "id"
  | "displayName"
  | "oauth"
  | "parseTokenResponse"
  | "validateConnection"
  | "listContacts"
  | "upsertContact"
> &
  Partial<
    Pick<
      CrmConnector,
      | "findContactByPhone"
      | "findContactByEmail"
      | "listCompanies"
      | "upsertCompany"
      | "listLeads"
      | "upsertLead"
      | "createTask"
      | "createNote"
      | "logCall"
      | "logSms"
      | "listUsers"
      | "listPipelines"
      | "listFields"
      | "handleWebhook"
    >
  >;

export type CrmProviderDefinition = {
  adapter: CrmConnector;
  /** Capability rows — defaults to feature-matrix entry for adapter.id */
  capabilities?: FeatureRow[];
  /** Event subscription override — defaults to runtime subscriptions */
  events?: ProviderEventSubscription;
};

/**
 * Validate and normalize a provider definition before registry registration.
 * Throws early if required SDK methods are missing.
 */
export function defineCrmProvider(def: CrmProviderDefinition): CrmConnector {
  const a = def.adapter;
  const required: Array<keyof CrmProviderSdk> = [
    "id",
    "displayName",
    "oauth",
    "parseTokenResponse",
    "validateConnection",
    "listContacts",
    "upsertContact",
  ];
  for (const key of required) {
    if (a[key] == null) {
      throw new Error(`CRM SDK: provider missing required method/field: ${String(key)}`);
    }
  }
  if (!a.oauth.clientIdEnv || !a.oauth.clientSecretEnv) {
    throw new Error(`CRM SDK: ${a.id} oauth env keys required`);
  }
  // Touch capability/subscription lookups so misconfigured ids fail at boot.
  void getFeatureMatrix(a.id as CrmProviderId);
  void (def.events || getProviderSubscription(a.id as CrmProviderId));
  return a;
}

/** Documented checklist for new adapters (also in docs). */
export const CRM_SDK_CHECKLIST = [
  "Authenticate (OAuth authorize + token parse)",
  "Refresh token",
  "Validate connection",
  "Search contact (phone/email)",
  "Create / update contact",
  "Create task",
  "Create note",
  "Create activity / log call / log SMS",
  "Push communication",
  "Capability definition (feature-matrix)",
  "Event subscription (supported / optional / unsupported)",
] as const;
