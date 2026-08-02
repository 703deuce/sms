import type { ExternalProviderId, ProviderCatalogEntry } from "./types";

export const NATIVE_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "calendly",
    displayName: "Calendly",
    category: "scheduling_forms",
    authKind: "oauth",
    description: "Appointments, invitees, and scheduling events for SMS reminders and call context.",
    oauthEnv: {
      clientId: "CALENDLY_CLIENT_ID",
      clientSecret: "CALENDLY_CLIENT_SECRET",
      scopes: ["default"],
    },
  },
  {
    id: "activecampaign",
    displayName: "ActiveCampaign",
    category: "crm_sales",
    authKind: "credentials",
    description: "Contacts, lists, tags, deals, and automations via your account API URL + key.",
    credentialHelp:
      "Settings → Developer → API Access. Copy the Account API URL and API key.",
    credentialFields: [
      {
        key: "apiUrl",
        label: "Account API URL",
        placeholder: "https://youraccount.api-us1.com",
        type: "url",
        required: true,
        help: "Exact API URL from ActiveCampaign Developer settings.",
      },
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "mailchimp",
    displayName: "Mailchimp",
    category: "marketing",
    authKind: "oauth",
    description: "Audiences, tags, merge fields, and marketing consent-safe sync.",
    /** Deferred for this live connect pass — keep adapter, hide from UI. */
    hiddenFromUi: true,
    oauthEnv: {
      clientId: "MAILCHIMP_CLIENT_ID",
      clientSecret: "MAILCHIMP_CLIENT_SECRET",
      scopes: [],
    },
  },
  {
    id: "highlevel",
    displayName: "HighLevel (Private Token)",
    category: "crm_sales",
    authKind: "credentials",
    description:
      "Private Integration Token for a specific HighLevel location — not universal OAuth.",
    credentialHelp:
      "Create a Private Integration Token for one location. This connection covers only that location.",
    credentialFields: [
      {
        key: "privateToken",
        label: "Private Integration Token",
        type: "password",
        required: true,
      },
      {
        key: "locationId",
        label: "Location ID",
        placeholder: "loc_...",
        required: true,
      },
      {
        key: "agencyId",
        label: "Agency / account ID (optional)",
        required: false,
      },
    ],
  },
  {
    id: "woocommerce",
    displayName: "WooCommerce",
    category: "ecommerce",
    authKind: "credentials",
    description: "Store customers, orders, and fulfillment events via merchant REST keys.",
    credentialHelp:
      "WooCommerce → Settings → Advanced → REST API. Create a key with Read/Write. Store must use HTTPS in production.",
    credentialFields: [
      {
        key: "storeUrl",
        label: "Store URL",
        placeholder: "https://yourstore.com",
        type: "url",
        required: true,
      },
      {
        key: "consumerKey",
        label: "Consumer key",
        type: "password",
        required: true,
      },
      {
        key: "consumerSecret",
        label: "Consumer secret",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "typeform",
    displayName: "Typeform",
    category: "scheduling_forms",
    authKind: "oauth",
    description: "Forms and response webhooks for lead capture and contact mapping.",
    oauthEnv: {
      clientId: "TYPEFORM_CLIENT_ID",
      clientSecret: "TYPEFORM_CLIENT_SECRET",
      scopes: ["forms:read", "responses:read", "webhooks:read", "webhooks:write", "offline"],
    },
  },
  {
    id: "jotform",
    displayName: "Jotform",
    category: "scheduling_forms",
    authKind: "credentials",
    description: "Forms and submissions via customer-generated API key.",
    credentialHelp: "Account → Settings → API. Generate an API key. Regional base URL if required.",
    credentialFields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
      {
        key: "apiBase",
        label: "API base (optional)",
        placeholder: "https://api.jotform.com",
        type: "url",
        required: false,
        help: "Use https://eu-api.jotform.com for EU accounts.",
      },
    ],
  },
  {
    id: "close",
    displayName: "Close CRM",
    category: "crm_sales",
    authKind: "credentials",
    description:
      "API-key connection for leads (account-like), contacts, opportunities, and activities.",
    credentialHelp:
      "Settings → API Keys. Keys are tied to your user/org. Disconnect deletes the stored key; revoke in Close anytime. Close Lead ≠ Transovo generic lead.",
    credentialFields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "freshdesk",
    displayName: "Freshdesk",
    category: "customer_support",
    authKind: "credentials",
    description: "Tickets, contacts, and agent notes via subdomain + personal API key.",
    credentialHelp: "Profile settings → View API key. Also need your helpdesk subdomain.",
    credentialFields: [
      {
        key: "subdomain",
        label: "Subdomain",
        placeholder: "yourcompany",
        required: true,
        help: "From https://yourcompany.freshdesk.com",
      },
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "klaviyo",
    displayName: "Klaviyo",
    category: "marketing",
    authKind: "credentials",
    description: "Profiles, lists, and consent-aware marketing events via scoped private API key.",
    credentialHelp:
      "Account → Settings → API Keys. Create a scoped private key (never full access unless required). Email and SMS consent are tracked separately.",
    credentialFields: [
      {
        key: "apiKey",
        label: "Private API key",
        type: "password",
        required: true,
      },
    ],
  },
];

export const NATIVE_PROVIDER_IDS = NATIVE_PROVIDER_CATALOG.map((p) => p.id);

/** Providers shown on /integrations/native (excludes Mailchimp for this pass). */
export const NATIVE_PROVIDER_UI_CATALOG = NATIVE_PROVIDER_CATALOG.filter((p) => !p.hiddenFromUi);

export function isExternalProvider(id: string): id is ExternalProviderId {
  return (NATIVE_PROVIDER_IDS as string[]).includes(id);
}

export function getCatalogEntry(id: ExternalProviderId): ProviderCatalogEntry {
  const entry = NATIVE_PROVIDER_CATALOG.find((p) => p.id === id);
  if (!entry) throw new Error(`Unknown provider ${id}`);
  return entry;
}

export const CATEGORY_LABELS: Record<string, string> = {
  crm_sales: "CRM and sales",
  scheduling_forms: "Scheduling and forms",
  marketing: "Marketing",
  ecommerce: "E-commerce",
  customer_support: "Customer support",
};

/** Existing CRM framework providers shown in the shared Integrations UI (not redesigned). */
export const EXISTING_CRM_UI_ENTRIES = [
  {
    id: "salesforce",
    displayName: "Salesforce",
    category: "crm_sales" as const,
    href: "/integrations/crm/salesforce",
    authKind: "oauth" as const,
  },
  {
    id: "zoho",
    displayName: "Zoho CRM",
    category: "crm_sales" as const,
    href: "/integrations/crm/zoho",
    authKind: "oauth" as const,
  },
  {
    id: "pipedrive",
    displayName: "Pipedrive",
    category: "crm_sales" as const,
    href: "/integrations/crm/pipedrive",
    authKind: "oauth" as const,
  },
];
