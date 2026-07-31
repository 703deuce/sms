import {
  getConnection,
  markSynced,
  upsertExternalContact,
} from "./connections";
import { refreshGoogleToken } from "./oauth";

type SyncResult = { imported: number; created: number; provider: string };

/** Dispatch a contact sync for the given provider using stored credentials. */
export async function syncProvider(
  workspaceId: string,
  provider: string,
): Promise<SyncResult> {
  switch (provider) {
    case "hubspot":
      return syncHubspot(workspaceId);
    case "shopify":
      return syncShopify(workspaceId);
    case "salesforce":
      return syncSalesforce(workspaceId);
    case "google_contacts":
      return syncGoogleContacts(workspaceId);
    default:
      throw new Error(`Sync not supported for provider: ${provider}`);
  }
}

async function importContacts(
  workspaceId: string,
  provider: string,
  contacts: Array<{
    phone?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
  }>,
): Promise<SyncResult> {
  let imported = 0;
  let created = 0;
  for (const c of contacts) {
    const result = await upsertExternalContact({
      workspaceId,
      phone: c.phone,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      source: provider,
    });
    if (result) {
      imported += 1;
      if (result.created) created += 1;
    }
  }
  await markSynced(workspaceId, provider, imported);
  return { imported, created, provider };
}

export async function syncHubspot(workspaceId: string): Promise<SyncResult> {
  const conn = await getConnection(workspaceId, "hubspot");
  const apiKey =
    conn?.accessToken || ((conn?.configJson as Record<string, unknown>)?.apiKey as string | undefined);
  if (!apiKey) throw new Error("HubSpot API key not configured");

  const url =
    "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,phone,mobilephone,email,company";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`HubSpot API ${res.status}`);
  const json = await res.json();
  const results = (json.results || []) as Array<{ properties: Record<string, string> }>;
  return importContacts(
    workspaceId,
    "hubspot",
    results.map((r) => ({
      phone: r.properties.phone || r.properties.mobilephone,
      email: r.properties.email,
      firstName: r.properties.firstname,
      lastName: r.properties.lastname,
      company: r.properties.company,
    })),
  );
}

export async function syncShopify(workspaceId: string): Promise<SyncResult> {
  const conn = await getConnection(workspaceId, "shopify");
  const config = (conn?.configJson || {}) as Record<string, unknown>;
  const shop = config.shopDomain as string | undefined;
  const token = (conn?.accessToken as string | undefined) || (config.accessToken as string | undefined);
  if (!shop || !token) throw new Error("Shopify shop domain / access token not configured");

  const domain = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${domain}/admin/api/2024-01/customers.json?limit=100`;
  const res = await fetch(url, { headers: { "X-Shopify-Access-Token": token } });
  if (!res.ok) throw new Error(`Shopify API ${res.status}`);
  const json = await res.json();
  const customers = (json.customers || []) as Array<{
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    default_address?: { phone?: string; company?: string };
  }>;
  return importContacts(
    workspaceId,
    "shopify",
    customers.map((c) => ({
      phone: c.phone || c.default_address?.phone,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      company: c.default_address?.company,
    })),
  );
}

export async function syncSalesforce(workspaceId: string): Promise<SyncResult> {
  const conn = await getConnection(workspaceId, "salesforce");
  const config = (conn?.configJson || {}) as Record<string, unknown>;
  const instanceUrl = config.instanceUrl as string | undefined;
  const token = (conn?.accessToken as string | undefined) || (config.accessToken as string | undefined);
  if (!instanceUrl || !token) throw new Error("Salesforce instance URL / access token not configured");

  const soql = encodeURIComponent(
    "SELECT FirstName, LastName, Phone, MobilePhone, Email, Account.Name FROM Contact LIMIT 200",
  );
  const url = `${instanceUrl.replace(/\/$/, "")}/services/data/v59.0/query?q=${soql}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Salesforce API ${res.status}`);
  const json = await res.json();
  const records = (json.records || []) as Array<{
    FirstName?: string;
    LastName?: string;
    Phone?: string;
    MobilePhone?: string;
    Email?: string;
    Account?: { Name?: string };
  }>;
  return importContacts(
    workspaceId,
    "salesforce",
    records.map((r) => ({
      phone: r.Phone || r.MobilePhone,
      email: r.Email,
      firstName: r.FirstName,
      lastName: r.LastName,
      company: r.Account?.Name,
    })),
  );
}

export async function syncGoogleContacts(workspaceId: string): Promise<SyncResult> {
  const token = await refreshGoogleToken(workspaceId, "google_contacts");
  if (!token) throw new Error("Google Contacts not connected");

  const url =
    "https://people.googleapis.com/v1/people/me/connections?pageSize=200&personFields=names,phoneNumbers,emailAddresses,organizations";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google People API ${res.status}`);
  const json = await res.json();
  const connections = (json.connections || []) as Array<{
    names?: Array<{ givenName?: string; familyName?: string }>;
    phoneNumbers?: Array<{ value?: string }>;
    emailAddresses?: Array<{ value?: string }>;
    organizations?: Array<{ name?: string }>;
  }>;
  return importContacts(
    workspaceId,
    "google_contacts",
    connections.map((p) => ({
      phone: p.phoneNumbers?.[0]?.value,
      email: p.emailAddresses?.[0]?.value,
      firstName: p.names?.[0]?.givenName,
      lastName: p.names?.[0]?.familyName,
      company: p.organizations?.[0]?.name,
    })),
  );
}
