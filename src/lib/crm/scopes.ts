/**
 * Least-privilege OAuth scopes — verified against official provider docs (2026-08).
 * Do not broaden these without documenting why.
 *
 * Sources:
 * - Salesforce: https://developer.salesforce.com/docs/platform/mobile-sdk/guide/oauth-scope-parameter-values.html
 *   Object CRUD is controlled by the authorizing user's permission sets, not OAuth scopes.
 * - Zoho CRM v8: https://www.zoho.com/crm/developer/docs/api/v8/scopes.html
 * - Pipedrive Marketplace scopes:
 *   https://pipedrive.readme.io/docs/marketplace-scopes-and-permissions-explanations
 */

import type { CrmProviderId } from "./types";

export type ScopeDoc = {
  scope: string;
  why: string;
};

export const SALESFORCE_SCOPES: ScopeDoc[] = [
  {
    scope: "api",
    why: "REST API access for Contacts, Leads, Accounts, Opportunities, Tasks, Notes. Object-level access follows the authorizing user's permission set (least privilege at user layer).",
  },
  {
    scope: "refresh_token",
    why: "Required to receive a refresh token for unattended sync after the user leaves.",
  },
  {
    scope: "offline_access",
    why: "Synonym of refresh_token in Salesforce OAuth; requested so refresh works across client/server configurations.",
  },
];

/** Intentionally NOT requested: full, web, chatter_api, lightning, custom_permissions, openid (unless UI identity needed). */

export const ZOHO_SCOPES: ScopeDoc[] = [
  {
    scope: "ZohoCRM.modules.contacts.ALL",
    why: "Read/create/update Contacts for sync and call/SMS association.",
  },
  {
    scope: "ZohoCRM.modules.leads.ALL",
    why: "Read/create/update Leads when auto-create leads is enabled.",
  },
  {
    scope: "ZohoCRM.modules.accounts.ALL",
    why: "Company/Account sync and association.",
  },
  {
    scope: "ZohoCRM.modules.deals.ALL",
    why: "Opportunity/Deal sync when enabled.",
  },
  {
    scope: "ZohoCRM.modules.tasks.ALL",
    why: "Follow-up tasks (missed call, callback, voicemail).",
  },
  {
    scope: "ZohoCRM.modules.notes.ALL",
    why: "Agent notes and communication notes.",
  },
  {
    scope: "ZohoCRM.modules.calls.ALL",
    why: "Native Calls module logging when available.",
  },
  {
    scope: "ZohoCRM.modules.search.READ",
    why: "Duplicate detection / phone search before create.",
  },
  {
    scope: "ZohoCRM.users.READ",
    why: "Owner mapping and default owner picker.",
  },
  {
    scope: "ZohoCRM.settings.modules.READ",
    why: "Discover available modules without settings.ALL.",
  },
  {
    scope: "ZohoCRM.settings.fields.READ",
    why: "Field mapping UI / custom field discovery.",
  },
];

/** Intentionally NOT requested: ZohoCRM.modules.ALL, ZohoCRM.settings.ALL, org.ALL, bulk.*, coql.* */

export const PIPEDRIVE_SCOPES: ScopeDoc[] = [
  {
    scope: "base",
    why: "Required baseline Marketplace scope for OAuth apps.",
  },
  {
    scope: "contacts:full",
    why: "Persons + Organizations create/read/update for contact/company sync (notes included).",
  },
  {
    scope: "deals:full",
    why: "Deals write + read pipelines/stages metadata needed for deal sync.",
  },
  {
    scope: "activities:full",
    why: "Log calls, SMS, and tasks as Activities.",
  },
  {
    scope: "users:read",
    why: "Owner mapping / default owner.",
  },
];

/** Intentionally NOT requested: mail:*, products:*, admin:*, deals:read-only when write required. */

export function scopesForProvider(provider: CrmProviderId): string[] {
  switch (provider) {
    case "salesforce":
      return SALESFORCE_SCOPES.map((s) => s.scope);
    case "zoho":
      return ZOHO_SCOPES.map((s) => s.scope);
    case "pipedrive":
      return PIPEDRIVE_SCOPES.map((s) => s.scope);
  }
}

export function scopeDocumentation(provider: CrmProviderId): ScopeDoc[] {
  switch (provider) {
    case "salesforce":
      return SALESFORCE_SCOPES;
    case "zoho":
      return ZOHO_SCOPES;
    case "pipedrive":
      return PIPEDRIVE_SCOPES;
  }
}
