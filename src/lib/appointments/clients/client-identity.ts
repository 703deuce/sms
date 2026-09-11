import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { visibleContactWhere } from "@/lib/contacts/visible-contacts";

export function normalizeClientEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v && v.includes("@") ? v : null;
}

export function normalizeClientPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  try {
    return normalizeE164(phone.trim());
  } catch {
    return null;
  }
}

export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  matchReason: "email" | "phone" | "both";
};

export async function findDuplicateClientCandidates(
  workspaceId: string,
  input: { email?: string; phone?: string; excludeContactId?: string },
): Promise<DuplicateCandidate[]> {
  const prisma = getPrisma();
  const email = normalizeClientEmail(input.email);
  const phone = normalizeClientPhone(input.phone);
  if (!email && !phone) return [];

  const base = visibleContactWhere(workspaceId);
  const or: Array<Record<string, unknown>> = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone) or.push({ phone });

  const rows = await prisma.contact.findMany({
    where: {
      ...base,
      ...(input.excludeContactId ? { NOT: { id: input.excludeContactId } } : {}),
      OR: or,
    },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });

  return rows.map((r) => {
    const emailMatch = email && normalizeClientEmail(r.email) === email;
    const phoneMatch = phone && r.phone === phone;
    const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Client";
    return {
      id: r.id,
      name,
      email: r.email,
      phone: r.phone,
      matchReason: emailMatch && phoneMatch ? "both" : emailMatch ? "email" : "phone",
    };
  });
}
