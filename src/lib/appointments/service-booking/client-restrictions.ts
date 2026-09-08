import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function listClientRestrictions(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.clientBookingRestriction.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertClientRestriction(
  workspaceId: string,
  input: {
    id?: string;
    contactId?: string;
    email?: string;
    phone?: string;
    blockPublicBooking?: boolean;
    blockPurchases?: boolean;
    blockSelfService?: boolean;
    displayMessage?: string;
    reason?: string;
    createdByUserId?: string;
  },
) {
  const prisma = getPrisma();
  const phone = input.phone ? normalizeE164(input.phone) : undefined;
  const data = {
    contactId: input.contactId,
    email: input.email?.trim().toLowerCase(),
    phone,
    blockPublicBooking: input.blockPublicBooking ?? true,
    blockPurchases: input.blockPurchases ?? true,
    blockSelfService: input.blockSelfService ?? true,
    displayMessage: input.displayMessage,
    reason: input.reason,
    createdByUserId: input.createdByUserId,
  };
  if (input.id) {
    return prisma.clientBookingRestriction.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.clientBookingRestriction.create({ data: { workspaceId, ...data } });
}

export async function assertClientNotRestricted(
  workspaceId: string,
  input: { contactId?: string; email?: string; phone?: string; action: "book" | "purchase" | "self_service" },
) {
  const prisma = getPrisma();
  const phone = input.phone ? normalizeE164(input.phone) : undefined;
  const email = input.email?.trim().toLowerCase();

  const restrictions = await prisma.clientBookingRestriction.findMany({
    where: {
      workspaceId,
      OR: [
        ...(input.contactId ? [{ contactId: input.contactId }] : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  for (const r of restrictions) {
    if (input.action === "book" && r.blockPublicBooking) {
      throw new Error(r.displayMessage || "Online booking is not available for this client");
    }
    if (input.action === "purchase" && r.blockPurchases) {
      throw new Error(r.displayMessage || "Purchases are not available for this client");
    }
    if (input.action === "self_service" && r.blockSelfService) {
      throw new Error(r.displayMessage || "Self-service changes are not available for this client");
    }
  }
}
