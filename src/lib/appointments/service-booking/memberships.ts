import "server-only";

import { getPrisma } from "@/lib/db";
import type { MembershipBenefits } from "./types";

export async function listMembershipProducts(workspaceId: string) {
  const prisma = getPrisma();
  const products = await prisma.serviceMembershipProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: {
      subscriptions: {
        where: { status: { in: ["active", "past_due", "paused"] } },
        select: { id: true },
      },
    },
  });
  return products.map((product: (typeof products)[number]) => {
    const { subscriptions, ...rest } = product;
    const benefits = (rest.benefits || {}) as MembershipBenefits;
    const creditSummary = (benefits.includedCredits || [])
      .map((rule) => `${rule.quantity} ${rule.label || rule.serviceName || "credits"}`)
      .join(", ");
    const discountSummary =
      benefits.percentDiscount != null ? `${benefits.percentDiscount}% off` : "";
    return {
      ...rest,
      memberCount: subscriptions.length,
      benefitsSummary: creditSummary || discountSummary || "Member benefits",
    };
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
  };
  if (input.id) {
    return prisma.serviceMembershipProduct.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.serviceMembershipProduct.create({ data: { workspaceId, ...data } });
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

export async function listMembershipSubscriptionsForProduct(
  workspaceId: string,
  productId: string,
) {
  const prisma = getPrisma();
  const subscriptions = await prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, productId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, priceCents: true, billingInterval: true } } },
  });
  type ContactLite = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  const contactIds = [...new Set(subscriptions.map((s: (typeof subscriptions)[number]) => s.contactId))];
  const contacts: ContactLite[] = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  return subscriptions.map((sub: (typeof subscriptions)[number]) => {
    const contact = contactMap.get(sub.contactId);
    const contactName =
      [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
      contact?.phone ||
      contact?.email ||
      "Member";
    const benefits = (sub.benefitsSnapshot || sub.product?.benefits || {}) as MembershipBenefits;
    const creditTotal = (benefits.includedCredits || []).reduce((sum, r) => sum + r.quantity, 0);
    return { ...sub, contactName, creditAllowance: creditTotal };
  });
}

export async function duplicateMembershipProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const source = await prisma.serviceMembershipProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!source) throw new Error("Membership not found");
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let n = 1;
  while (
    await prisma.serviceMembershipProduct.findFirst({ where: { workspaceId, slug } })
  ) {
    slug = `${baseSlug}-${n++}`;
  }
  return prisma.serviceMembershipProduct.create({
    data: {
      workspaceId,
      name: `${source.name} (copy)`,
      slug,
      description: source.description,
      priceCents: source.priceCents,
      currency: source.currency,
      billingInterval: source.billingInterval,
      benefits: source.benefits,
      stripePriceId: source.stripePriceId,
      active: false,
      metadata: source.metadata,
    },
  });
}
