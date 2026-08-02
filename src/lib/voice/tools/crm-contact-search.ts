/**
 * CRM contact search for voice agents — routes through Transovo CRM adapters
 * (Salesforce / Zoho / Pipedrive), never through a second Telnyx CRM auth.
 *
 * Privacy: by default do not speak another contact’s phone aloud on public
 * inbound calls. Full numbers are only returned in browser/internal test mode.
 */

import { getPrisma } from "@/lib/db";
import { CRM_PROVIDER_IDS, getConnector } from "@/lib/crm/registry";
import type { CrmProviderId } from "@/lib/crm/types";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type CrmContactSearchMatch = {
  displayName: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  owner?: string | null;
  recordType: "local" | "crm_contact";
  provider?: string;
  safeId: string;
  /** Redacted for spoken production use unless speakAllowed. */
  speakPhone?: string | null;
};

export async function searchCrmContactsForVoice(input: {
  workspaceId: string;
  query?: string;
  phone?: string;
  email?: string;
  matchType?: "auto" | "name" | "phone" | "email";
  limit?: number;
  /** When true (browser/internal test), return full phone numbers. */
  allowSpeakPhone?: boolean;
}) {
  const limit = Math.min(5, Math.max(1, input.limit ?? 3));
  const q = String(input.query || "").trim();
  const phone = input.phone ? normalizeE164(String(input.phone)) : "";
  const email = input.email ? String(input.email).trim().toLowerCase() : "";
  const matchType = input.matchType || "auto";
  const speakAllowed = Boolean(input.allowSpeakPhone);

  const matches: CrmContactSearchMatch[] = [];
  const prisma = getPrisma();

  // 1) Local Transovo contacts (fast, always available).
  if (phone && (matchType === "auto" || matchType === "phone")) {
    const local = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
    });
    if (local) {
      matches.push(formatLocal(local, speakAllowed));
    }
  }
  if (email && matches.length < limit && (matchType === "auto" || matchType === "email")) {
    const local = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email },
    });
    if (local && !matches.some((m) => m.safeId === `local:${local.id}`)) {
      matches.push(formatLocal(local, speakAllowed));
    }
  }
  if (q && matches.length < limit && (matchType === "auto" || matchType === "name")) {
    const parts = q.split(/\s+/).filter(Boolean);
    const locals = await prisma.contact.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          ...(parts.length >= 2
            ? [
                {
                  AND: [
                    { firstName: { contains: parts[0], mode: "insensitive" as const } },
                    { lastName: { contains: parts[1], mode: "insensitive" as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: limit,
    });
    for (const local of locals) {
      if (matches.length >= limit) break;
      if (matches.some((m) => m.safeId === `local:${local.id}`)) continue;
      matches.push(formatLocal(local, speakAllowed));
    }
  }

  // 2) Connected CRMs via Transovo adapters (no bulk dump).
  const connected = await prisma.integrationConnection.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });

  for (const row of connected) {
    if (matches.length >= limit) break;
    const provider = row.provider as CrmProviderId;
    try {
      const { buildContext } = await import("@/lib/crm/sync-engine");
      const ctx = await buildContext(input.workspaceId, provider);
      const connector = getConnector(provider);
      const foundRows: Array<{
        id?: string;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        email?: string | null;
        companyName?: string | null;
        ownerExternalId?: string | null;
      }> = [];

      if (phone && connector.findContactByPhone && (matchType === "auto" || matchType === "phone")) {
        const found = await connector.findContactByPhone(ctx, phone).catch(() => null);
        if (found?.id) foundRows.push(found);
      }
      if (
        email &&
        connector.findContactByEmail &&
        (matchType === "auto" || matchType === "email")
      ) {
        const found = await connector.findContactByEmail(ctx, email).catch(() => null);
        if (found?.id && !foundRows.some((f) => f.id === found.id)) foundRows.push(found);
      }
      // Name / free-text search via provider word search (Zoho) or local filter.
      if (q && (matchType === "auto" || matchType === "name") && foundRows.length < limit) {
        const named = await searchCrmByName(provider, ctx, q, limit).catch(() => []);
        for (const n of named) {
          if (foundRows.some((f) => f.id === n.id)) continue;
          foundRows.push(n);
          if (foundRows.length >= limit) break;
        }
      }

      for (const found of foundRows) {
        if (matches.length >= limit) break;
        if (!found?.id) continue;
        const safeId = `crm:${provider}:${found.id}`;
        if (matches.some((m) => m.safeId === safeId)) continue;
        const phoneVal = found.phone || null;
        matches.push({
          displayName:
            [found.firstName, found.lastName].filter(Boolean).join(" ") ||
            found.email ||
            "CRM contact",
          phone: speakAllowed ? phoneVal : phoneVal ? redactPhone(phoneVal) : null,
          speakPhone: speakAllowed ? phoneVal : null,
          email: found.email || null,
          company: found.companyName || null,
          owner: found.ownerExternalId || null,
          recordType: "crm_contact",
          provider,
          safeId,
        });
      }
    } catch {
      // Provider optional
    }
  }

  return {
    matchCount: matches.length,
    ambiguous: matches.length > 1,
    speakAllowed,
    policy: speakAllowed
      ? "internal_test_may_speak_phone"
      : "production_no_third_party_phone_disclosure",
    matches: matches.slice(0, limit),
    guidance:
      matches.length === 0
        ? "No match found. Ask the caller to clarify name, phone, or email."
        : matches.length > 1
          ? "Multiple matches. Ask the caller to confirm which person before using any details."
          : speakAllowed
            ? "Single match. You may confirm the permitted phone if this is an internal test."
            : "Single match. Use for recognition/routing only — do not read another person’s phone number aloud to an unknown caller.",
  };
}

function formatLocal(
  contact: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
  },
  speakAllowed: boolean,
): CrmContactSearchMatch {
  const phoneVal = contact.phone || null;
  return {
    displayName:
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.phone ||
      "Contact",
    phone: speakAllowed ? phoneVal : phoneVal ? redactPhone(phoneVal) : null,
    speakPhone: speakAllowed ? phoneVal : null,
    email: contact.email || null,
    company: contact.company || null,
    recordType: "local",
    safeId: `local:${contact.id}`,
  };
}

function redactPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

async function searchCrmByName(
  provider: CrmProviderId,
  ctx: { accessToken: string; meta?: Record<string, unknown>; preferences?: Record<string, unknown> },
  query: string,
  limit: number,
) {
  const q = query.trim();
  if (!q) return [];
  if (provider === "zoho") {
    const { crmFetch } = await import("@/lib/crm/http");
    const domain = String(ctx.meta?.apiDomain || "https://www.zohoapis.com").replace(
      /\/$/,
      "",
    );
    const base =
      ctx.preferences?.zohoProduct === "bigin"
        ? `${domain}/bigin/v2`
        : `${domain}/crm/v2`;
    const word = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
      `${base}/Contacts/search?word=${encodeURIComponent(q)}`,
      { accessToken: ctx.accessToken },
    ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    const rows = (word.data || []).slice(0, limit);
    if (rows.length) {
      return rows.map((r) => ({
        id: String(r.id),
        firstName: (r.First_Name as string) || null,
        lastName: (r.Last_Name as string) || null,
        phone: (r.Phone as string) || (r.Mobile as string) || null,
        email: (r.Email as string) || null,
        companyName:
          typeof r.Account_Name === "object" && r.Account_Name
            ? String((r.Account_Name as { name?: string }).name || "")
            : null,
      }));
    }
    const parts = q.split(/\s+/).filter(Boolean);
    const criteria =
      parts.length >= 2
        ? `((First_Name:starts_with:${parts[0]})and(Last_Name:starts_with:${parts[1]}))`
        : `((First_Name:starts_with:${q})or(Last_Name:starts_with:${q}))`;
    const byCrit = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
      `${base}/Contacts/search?criteria=${encodeURIComponent(criteria)}`,
      { accessToken: ctx.accessToken },
    ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    return (byCrit.data || []).slice(0, limit).map((r) => ({
      id: String(r.id),
      firstName: (r.First_Name as string) || null,
      lastName: (r.Last_Name as string) || null,
      phone: (r.Phone as string) || (r.Mobile as string) || null,
      email: (r.Email as string) || null,
      companyName: null,
    }));
  }

  // Salesforce / Pipedrive: scan a small page and filter locally by name.
  const connector = getConnector(provider);
  const page = await connector.listContacts(ctx as never, null).catch(() => null);
  if (!page?.items?.length) return [];
  const lower = q.toLowerCase();
  return page.items
    .filter((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").toLowerCase();
      return name.includes(lower) || (c.email || "").toLowerCase().includes(lower);
    })
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      companyName: c.companyName,
      ownerExternalId: c.ownerExternalId,
    }));
}
