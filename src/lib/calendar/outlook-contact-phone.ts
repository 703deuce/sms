import "server-only";

import { MICROSOFT_GRAPH_V1 } from "@/lib/microsoft/graph-helpers";

type GraphContactPhone = {
  number?: string;
  type?: string;
};

type GraphContact = {
  displayName?: string;
  emailAddresses?: Array<{ address?: string; name?: string }>;
  mobilePhone?: string;
  businessPhones?: string[];
  homePhones?: string[];
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

function pickPhone(contact: GraphContact): string | null {
  const candidates = [
    contact.mobilePhone,
    ...(contact.businessPhones || []),
    ...(contact.homePhones || []),
  ].filter(Boolean) as string[];
  return candidates[0]?.trim() || null;
}

/**
 * Best-effort lookup of a customer phone from Outlook contacts via Microsoft Graph.
 * Requires Contacts.Read on the calendar connection token (reconnect after scope bump).
 */
export async function lookupOutlookContactPhoneByEmail(
  accessToken: string,
  email: string,
): Promise<{ phone: string | null; displayName?: string | null; source: "outlook_contact" } | null> {
  const target = normalizeEmail(email);
  if (!target) return null;

  const filter = encodeURIComponent(`emailAddresses/any(a:a/address eq '${target.replace(/'/g, "''")}')`);
  const url = `${MICROSOFT_GRAPH_V1}/me/contacts?$top=5&$filter=${filter}&$select=displayName,emailAddresses,mobilePhone,businessPhones,homePhones`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
  });

  if (res.status === 403 || res.status === 401) {
    return null;
  }
  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { value?: GraphContact[] };
  const match = (json.value || []).find((c) =>
    (c.emailAddresses || []).some((a) => normalizeEmail(a.address) === target),
  );
  if (!match) return null;

  const phone = pickPhone(match);
  if (!phone) return null;

  return { phone, displayName: match.displayName || null, source: "outlook_contact" };
}
