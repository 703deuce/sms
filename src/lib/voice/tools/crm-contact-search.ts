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
  score?: number;
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
  const tokens = tokenizeName(q);

  const matches: CrmContactSearchMatch[] = [];
  const prisma = getPrisma();

  // 1) Local Transovo contacts (fast, always available).
  if (phone && (matchType === "auto" || matchType === "phone")) {
    const local = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
    });
    if (local) matches.push(formatLocal(local, speakAllowed, 100));
  }
  if (email && matches.length < limit && (matchType === "auto" || matchType === "email")) {
    const local = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email },
    });
    if (local && !matches.some((m) => m.safeId === `local:${local.id}`)) {
      matches.push(formatLocal(local, speakAllowed, 90));
    }
  }
  if (q && (matchType === "auto" || matchType === "name")) {
    // Fetch by first/last token separately — Prisma-compat AND/contains is unreliable.
    const tokenQueries = tokens.length ? tokens : [q];
    const locals = await prisma.contact.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: tokenQueries.flatMap((tok) => [
          { firstName: { contains: tok, mode: "insensitive" as const } },
          { lastName: { contains: tok, mode: "insensitive" as const } },
          { company: { contains: tok, mode: "insensitive" as const } },
        ]),
      },
      take: 40,
    });
    const ranked = locals
      .map((local: Parameters<typeof formatLocal>[0]) => {
        const display =
          [local.firstName, local.lastName].filter(Boolean).join(" ") ||
          local.company ||
          "";
        const score = scoreNameMatch(q, tokens, display, local.company || "");
        return { local, score };
      })
      .filter((r: { score: number }) => r.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    for (const { local, score } of ranked) {
      if (matches.length >= limit) break;
      if (matches.some((m) => m.safeId === `local:${local.id}`)) continue;
      matches.push(formatLocal(local, speakAllowed, score));
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
        score?: number;
      }> = [];

      if (phone && connector.findContactByPhone && (matchType === "auto" || matchType === "phone")) {
        const found = await connector.findContactByPhone(ctx, phone).catch(() => null);
        if (found?.id) foundRows.push({ ...found, score: 100 });
      }
      if (
        email &&
        connector.findContactByEmail &&
        (matchType === "auto" || matchType === "email")
      ) {
        const found = await connector.findContactByEmail(ctx, email).catch(() => null);
        if (found?.id && !foundRows.some((f) => f.id === found.id)) {
          foundRows.push({ ...found, score: 90 });
        }
      }
      if (q && (matchType === "auto" || matchType === "name") && foundRows.length < limit) {
        const named = await searchCrmByName(provider, ctx, q, Math.max(limit, 8)).catch(
          () => [],
        );
        for (const n of named) {
          if (foundRows.some((f) => f.id === n.id)) continue;
          const display = [n.firstName, n.lastName].filter(Boolean).join(" ");
          const score = scoreNameMatch(q, tokens, display, n.companyName || "");
          if (score <= 0) continue;
          foundRows.push({ ...n, score });
        }
        foundRows.sort((a, b) => (b.score || 0) - (a.score || 0));
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
          score: found.score || 50,
        });
      }
    } catch {
      // Provider optional
    }
  }

  // Final relevance gate — never return unrelated contacts for a name query.
  const filtered =
    q && (matchType === "auto" || matchType === "name")
      ? matches
          .filter((m) => (m.score || 0) > 0 || !tokens.length)
          .sort((a, b) => (b.score || 0) - (a.score || 0))
      : matches;

  const top = filtered.slice(0, limit);
  const best = top[0];

  return {
    ok: true,
    matchCount: top.length,
    ambiguous: top.length > 1,
    speakAllowed,
    policy: speakAllowed
      ? "internal_test_may_speak_phone"
      : "production_no_third_party_phone_disclosure",
    matches: top,
    guidance:
      top.length === 0
        ? "No match found. Ask the caller to clarify name, phone, or email."
        : top.length > 1
          ? "Multiple matches. Ask the caller to confirm which person before using any details."
          : speakAllowed
            ? "Single match. You may confirm the permitted phone if this is an internal test."
            : "Single match found. Confirm the name with the caller. Do not read another person’s full phone number aloud on a public inbound call — you may say you found them and offer to transfer or take a message.",
    speak:
      top.length === 0
        ? `I couldn't find anyone named ${q || "that"}. Can you spell the name?`
        : top.length === 1
          ? speakAllowed && best?.speakPhone
            ? `I found ${best.displayName}${best.company ? ` at ${best.company}` : ""}, phone ${best.speakPhone}.`
            : `I found ${best?.displayName}${best?.company ? ` at ${best.company}` : ""}${best?.provider ? ` in ${best.provider}` : ""}. I can transfer you or take a message — I won't read their full phone number on this line.`
          : `I found ${top.length} possible matches, including ${best?.displayName}. Which person did you mean?`,
  };
}

function tokenizeName(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Higher is better. 0 = unrelated (must not return). */
function scoreNameMatch(
  rawQuery: string,
  tokens: string[],
  displayName: string,
  company: string,
) {
  const name = displayName.toLowerCase().trim();
  const comp = company.toLowerCase().trim();
  const q = rawQuery.toLowerCase().trim();
  if (!q) return 0;
  if (name === q) return 100;
  if (name.startsWith(q) || name.includes(` ${q}`)) return 90;
  if (!tokens.length) {
    return name.includes(q) || comp.includes(q) ? 40 : 0;
  }
  const nameTokens = tokenizeName(name);
  let hit = 0;
  for (const t of tokens) {
    if (nameTokens.some((nt) => nt === t || nt.startsWith(t) || t.startsWith(nt))) {
      hit += 1;
    } else if (comp.includes(t)) {
      hit += 0.25;
    }
  }
  if (hit <= 0) return 0;
  // Require all tokens for multi-word queries (Jennifer Testcross, David Kelly).
  if (tokens.length >= 2 && hit < tokens.length) return 0;
  return Math.round(50 + (hit / tokens.length) * 40);
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
  score = 50,
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
    score,
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
    const parts = q.split(/\s+/).filter(Boolean);
    const attempts: string[] = [];
    // Zoho word search is unreliable with multi-word — try last name, first name, then full.
    if (parts.length >= 2) {
      attempts.push(parts[parts.length - 1], parts[0], q);
    } else {
      attempts.push(q);
    }
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      email: string | null;
      companyName: string | null;
    }> = [];

    for (const word of attempts) {
      const wordRes = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
        `${base}/Contacts/search?word=${encodeURIComponent(word)}`,
        { accessToken: ctx.accessToken },
      ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
      for (const r of wordRes.data || []) {
        const id = String(r.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          firstName: (r.First_Name as string) || null,
          lastName: (r.Last_Name as string) || null,
          phone: (r.Phone as string) || (r.Mobile as string) || null,
          email: (r.Email as string) || null,
          companyName:
            typeof r.Account_Name === "object" && r.Account_Name
              ? String((r.Account_Name as { name?: string }).name || "")
              : null,
        });
        if (out.length >= limit) return out;
      }
    }

    if (parts.length >= 2) {
      const criteria = `((First_Name:starts_with:${parts[0]})and(Last_Name:starts_with:${parts[1]}))`;
      const byCrit = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
        `${base}/Contacts/search?criteria=${encodeURIComponent(criteria)}`,
        { accessToken: ctx.accessToken },
      ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
      for (const r of byCrit.data || []) {
        const id = String(r.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          firstName: (r.First_Name as string) || null,
          lastName: (r.Last_Name as string) || null,
          phone: (r.Phone as string) || (r.Mobile as string) || null,
          email: (r.Email as string) || null,
          companyName: null,
        });
      }
    }
    return out.slice(0, limit);
  }

  // Salesforce / Pipedrive: scan a small page and filter locally by name.
  const connector = getConnector(provider);
  const page = await connector.listContacts(ctx as never, null).catch(() => null);
  if (!page?.items?.length) return [];
  const tokens = tokenizeName(q);
  return page.items
    .map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
      return { c, score: scoreNameMatch(q, tokens, name, c.companyName || "") };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c }) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      companyName: c.companyName,
      ownerExternalId: c.ownerExternalId,
    }));
}
