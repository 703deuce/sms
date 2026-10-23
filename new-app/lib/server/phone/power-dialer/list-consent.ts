import { getPrisma } from "@/lib/server/db";

export type ListDialConsentBasis = {
  basis: "existing_permission" | "lead_form" | "purchased_list" | "other";
  notes?: string;
  attestedAt?: string;
  attestedByUserId?: string;
};

export function parseListDialConsent(raw: unknown): ListDialConsentBasis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const basis = o.basis;
  if (
    basis !== "existing_permission" &&
    basis !== "lead_form" &&
    basis !== "purchased_list" &&
    basis !== "other"
  ) {
    return null;
  }
  return {
    basis,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    attestedAt: typeof o.attestedAt === "string" ? o.attestedAt : undefined,
    attestedByUserId:
      typeof o.attestedByUserId === "string" ? o.attestedByUserId : undefined,
  };
}

/** M55 — list-level permission exception (does not override opt-out / DNC). */
export async function contactHasListConsentException(
  workspaceId: string,
  contactId: string,
  listId: string | null | undefined,
): Promise<boolean> {
  if (!listId) return false;
  const prisma = getPrisma();
  const member = await prisma.contactListMember.findFirst({
    where: { listId, contactId },
    select: { listId: true },
  });
  if (!member) return false;
  const list = await prisma.contactList.findFirst({
    where: { id: listId, workspaceId },
    select: { dialConsentJson: true },
  });
  const basis = parseListDialConsent(list?.dialConsentJson);
  return Boolean(basis?.basis && basis.attestedAt);
}
