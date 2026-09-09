import "server-only";

import { getPrisma } from "@/lib/db";
import type { MembershipBenefits } from "./types";

export async function listMembershipProducts(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertMembershipProduct(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    priceCents: number;
    billingInterval: string;
    benefits?: MembershipBenefits;
    stripePriceId?: string;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const data = {
    name: input.name.trim(),
    slug,
    description: input.description,
    priceCents: input.priceCents,
    billingInterval: input.billingInterval,
    benefits: input.benefits || {},
    stripePriceId: input.stripePriceId,
    active: input.active ?? true,
    ...(input.metadata != null ? { metadata: input.metadata } : {}),
  };
  if (input.id) {
    return prisma.serviceMembershipProduct.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.serviceMembershipProduct.create({ data: { workspaceId, ...data } });
}

export async function getMembershipProductDetail(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const product = await prisma.serviceMembershipProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!product) return null;

  const subscriptions = await prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, productId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const contactIds = [...new Set(subscriptions.map((s) => s.contactId))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const activeMemberCount = subscriptions.filter((s) => s.status === "active").length;

  return {
    product,
    subscriptions: subscriptions.map((s) => ({
      ...s,
      contact: contactMap.get(s.contactId) || null,
    })),
    activeMemberCount,
  };
}

export async function startMembershipSubscription(
  workspaceId: string,
  productId: string,
  contactId: string,
  stripeSubscriptionId?: string,
) {
  const prisma = getPrisma();
  const product = await prisma.serviceMembershipProduct.findFirst({
    where: { id: productId, workspaceId, active: true },
  });
  if (!product) throw new Error("Membership product not found");

  return prisma.serviceMembershipSubscription.create({
    data: {
      workspaceId,
      productId,
      contactId,
      status: "active",
      stripeSubscriptionId,
      benefitsSnapshot: product.benefits,
    },
  });
}

export async function markMembershipPastDue(subscriptionId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "past_due" },
  });
}
