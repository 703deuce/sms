import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** Resolve tenant from the called number (authoritative for inbound webhooks). */
export async function resolveWorkspaceByInboundNumber(toE164: string): Promise<string | null> {
  const prisma = getPrisma();
  const normalized = normalizeE164(toE164);
  const pn = await prisma.phoneNumber.findFirst({
    where: {
      OR: [{ e164: toE164 }, { e164: normalized }],
      status: "Active",
    },
    select: { workspaceId: true },
    orderBy: { purchasedAt: "asc" },
  });
  return pn?.workspaceId ?? null;
}

export async function resolveWorkspaceForPhoneEvent(toE164?: string | null): Promise<string> {
  if (toE164?.trim()) {
    const fromNumber = await resolveWorkspaceByInboundNumber(toE164);
    if (fromNumber) return fromNumber;
  }
  return resolveWorkspaceId();
}
