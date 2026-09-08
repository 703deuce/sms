import "server-only";

import { getPrisma } from "@/lib/db";
import type { MembershipBenefits } from "./types";

export type MembershipStatus =
  | "active"
  | "pending"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused";

export async function pauseMembershipSubscription(
  subscriptionId: string,
  pausedUntil?: Date,
) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "paused", pausedUntil },
  });
}

export async function resumeMembershipSubscription(subscriptionId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "active", pausedUntil: null },
  });
}

export async function cancelMembershipSubscription(
  subscriptionId: string,
  mode: "immediate" | "end_of_period",
) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) throw new Error("Subscription not found");

  if (mode === "immediate") {
    return prisma.serviceMembershipSubscription.update({
      where: { id: subscriptionId },
      data: { status: "canceled", metadata: { ...(sub.metadata as object), canceledAt: new Date().toISOString() } },
    });
  }
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: {
      metadata: {
        ...(sub.metadata as object),
        cancelAtPeriodEnd: true,
        cancelRequestedAt: new Date().toISOString(),
      },
    },
  });
}

export async function suspendMembershipForFailedPayment(subscriptionId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "past_due" },
  });
}

export async function restoreMembershipAfterPaymentRecovery(subscriptionId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "active" },
  });
}

export function membershipEntitlementsActive(status: string): boolean {
  return status === "active";
}

export function isMemberOnlyType(
  benefits: MembershipBenefits | null | undefined,
  typeId: string,
): boolean {
  const ids = benefits?.memberOnlyTypeIds || [];
  return ids.includes(typeId);
}

export async function listMembershipHistoryForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, contactId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}
