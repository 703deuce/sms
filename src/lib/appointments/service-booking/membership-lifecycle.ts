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

export async function listMemberOnlyBookingTypeIds(workspaceId: string): Promise<Set<string>> {
  const prisma = getPrisma();
  const products = await prisma.serviceMembershipProduct.findMany({
    where: { workspaceId, active: true },
    select: { benefits: true },
  });
  const ids = new Set<string>();
  for (const product of products) {
    const benefits = (product.benefits || {}) as MembershipBenefits;
    for (const typeId of benefits.memberOnlyTypeIds || []) {
      ids.add(typeId);
    }
  }
  return ids;
}

/** Throws when a booking type is member-restricted and contact lacks active membership. */
export async function assertMemberAccessForBookingType(
  workspaceId: string,
  contactId: string | null | undefined,
  bookingTypeId: string | undefined,
): Promise<void> {
  if (!bookingTypeId) return;
  const memberOnlyIds = await listMemberOnlyBookingTypeIds(workspaceId);
  if (!memberOnlyIds.has(bookingTypeId)) return;
  if (!contactId) {
    throw new Error("An active membership is required to book this service.");
  }
  const prisma = getPrisma();
  const subscriptions = await prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, contactId, status: "active" },
    include: { product: true },
  });
  const allowed = subscriptions.some((sub: (typeof subscriptions)[number]) =>
    isMemberOnlyType((sub.product?.benefits || {}) as MembershipBenefits, bookingTypeId),
  );
  if (!allowed) {
    throw new Error("An active membership is required to book this service.");
  }
}

export async function listMembershipHistoryForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, contactId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}
