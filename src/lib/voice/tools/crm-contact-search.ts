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

  // 2) Connected CRMs via Transovo adapters (phone/email only — no bulk dump).
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
      let found = null;
      if (phone && connector.findContactByPhone && (matchType === "auto" || matchType === "phone")) {
        found = await connector.findContactByPhone(ctx, phone).catch(() => null);
      }
      if (
        !found &&
        email &&
        connector.findContactByEmail &&
        (matchType === "auto" || matchType === "email")
      ) {
        found = await connector.findContactByEmail(ctx, email).catch(() => null);
      }
      if (found?.id) {
        const safeId = `crm:${provider}:${found.id}`;
        if (!matches.some((m) => m.safeId === safeId)) {
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
