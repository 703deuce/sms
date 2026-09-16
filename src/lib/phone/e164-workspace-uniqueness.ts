import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { mctbTexmlE164Variants } from "@/lib/mctb/texml-ingress/e164-lookup";

export type E164OwnerRow = {
  id: string;
  workspaceId: string;
  e164: string;
  status: string | null;
};

/**
 * A real DID may belong to exactly one workspace at a time.
 * Multiple workspaces with the same E.164 breaks inbound resolution and future multi-tenant isolation.
 */
export async function findActiveE164Owner(
  rawE164: string,
  options?: { exceptWorkspaceId?: string },
): Promise<E164OwnerRow | null> {
  const normalized = normalizeE164(rawE164) || rawE164.trim();
  const variants = mctbTexmlE164Variants(normalized);
  if (!variants.length) return null;

  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: {
      e164: { in: variants },
      status: { not: "Released" },
      ...(options?.exceptWorkspaceId
        ? { workspaceId: { not: options.exceptWorkspaceId } }
        : {}),
    },
    select: { id: true, workspaceId: true, e164: true, status: true },
    orderBy: { purchasedAt: "desc" },
  });
}

/** Throws when another workspace already owns this active E.164. */
export async function assertE164AssignableToWorkspace(
  workspaceId: string,
  rawE164: string,
): Promise<void> {
  const conflict = await findActiveE164Owner(rawE164, { exceptWorkspaceId: workspaceId });
  if (!conflict) return;
  throw new Error(
    `phone_e164_already_assigned: ${conflict.e164} is active on workspace ${conflict.workspaceId} (row ${conflict.id})`,
  );
}
