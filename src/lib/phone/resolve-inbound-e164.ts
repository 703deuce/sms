import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveBestMctbIngressPhoneRow } from "@/lib/mctb/texml-ingress/resolve-phone-row";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { mctbTexmlE164Variants } from "@/lib/mctb/texml-ingress/e164-lookup";

export type InboundPhoneRow = {
  id: string;
  workspaceId: string;
  e164: string;
};

/**
 * Resolve the canonical phone_numbers row for an inbound E.164.
 * Prefer scored MCTB ingress resolution, then ws_1-owned row, never nondeterministic findFirst.
 */
export async function resolveInboundPhoneRowByE164(
  toE164: string,
): Promise<InboundPhoneRow | null> {
  const best = await resolveBestMctbIngressPhoneRow(toE164);
  if (best) {
    return { id: best.id, workspaceId: best.workspaceId, e164: best.e164 };
  }

  const variants = mctbTexmlE164Variants(toE164);
  if (!variants.length) return null;

  const prisma = getPrisma();
  const ownerWs = resolveMctbPlatformOwnerWorkspaceId();
  const ownerRow = await prisma.phoneNumber.findFirst({
    where: { e164: { in: variants }, workspaceId: ownerWs, status: { not: "Released" } },
    select: { id: true, workspaceId: true, e164: true },
  });
  if (ownerRow) return ownerRow;

  return prisma.phoneNumber.findFirst({
    where: { e164: { in: variants }, status: { not: "Released" } },
    select: { id: true, workspaceId: true, e164: true },
    orderBy: { purchasedAt: "desc" },
  });
}
