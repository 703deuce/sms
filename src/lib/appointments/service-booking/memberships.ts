import "server-only";

import { getPrisma } from "@/lib/db";
import type { MembershipBenefits } from "./types";

export type MembershipProductRow = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string;
  benefits: unknown;
  stripePriceId: string | null;
  active: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipCatalogStats = {
  activeMemberships: number;
  activeMembers: number;
  pastDue: number;
  monthlyRecurringRevenueCents: number;
  renewalsThisMonth: number;
};

export type MembershipSubscriptionRow = {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  status: string;
  startedAt: string;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  amountCents: number;
  cancelAtPeriodEnd: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type MembershipActivityRow = {
  id: string;
  contactId: string;
  contactName: string;
  event: string;
  billingCents: number | null;
  reference: string | null;
  status: string;
  createdAt: string;
};

function contactDisplayName(contact: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (contact.name?.trim()) return contact.name.trim();
  if (contact.email?.trim()) return contact.email.trim();
  return "Customer";
}

function monthlyFactor(interval: string): number {
  const key = interval.toLowerCase();
  if (key === "year" || key === "annual" || key === "yearly") return 1 / 12;
  if (key === "quarter" || key === "quarterly") return 1 / 3;
  return 1;
}

export async function listMembershipProducts(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.serviceMembershipProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function getMembershipProduct(
  workspaceId: string,
  productId: string,
): Promise<MembershipProductRow | null> {
  const prisma = getPrisma();
  return prisma.serviceMembershipProduct.findFirst({
    where: { id: productId, workspaceId },
  });
}

export async function getMembershipCatalogStats(
  workspaceId: string,
): Promise<MembershipCatalogStats> {
  const prisma = getPrisma();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activeMemberships, subscriptions] = await Promise.all([
    prisma.serviceMembershipProduct.count({ where: { workspaceId, active: true } }),
    prisma.serviceMembershipSubscription.findMany({
      where: { workspaceId },
      include: { product: true },
    }),
  ]);

  let activeMembers = 0;
  let pastDue = 0;
  let monthlyRecurringRevenueCents = 0;
  let renewalsThisMonth = 0;

  for (const sub of subscriptions) {
    if (sub.status === "active") {
      activeMembers += 1;
      const price = sub.product?.priceCents ?? 0;
      const interval = sub.product?.billingInterval ?? "month";
      monthlyRecurringRevenueCents += Math.round(price * monthlyFactor(interval));
    }
    if (sub.status === "past_due") pastDue += 1;
    if (sub.currentPeriodEnd && sub.currentPeriodEnd >= monthStart) {
      renewalsThisMonth += 1;
    }
  }

  return {
    activeMemberships,
    activeMembers,
    pastDue,
    monthlyRecurringRevenueCents,
    renewalsThisMonth,
  };
}

export async function countMembershipSubscribers(
  workspaceId: string,
  productIds: string[],
): Promise<Map<string, { active: number; pastDue: number }>> {
  if (productIds.length === 0) return new Map();
  const prisma = getPrisma();
  const rows = await prisma.serviceMembershipSubscription.groupBy({
    by: ["productId", "status"],
    where: { workspaceId, productId: { in: productIds }, status: { in: ["active", "past_due"] } },
    _count: { productId: true },
  });
  const map = new Map<string, { active: number; pastDue: number }>();
  for (const id of productIds) map.set(id, { active: 0, pastDue: 0 });
  for (const row of rows) {
    const entry = map.get(row.productId) || { active: 0, pastDue: 0 };
    if (row.status === "active") entry.active = row._count.productId;
    if (row.status === "past_due") entry.pastDue = row._count.productId;
    map.set(row.productId, entry);
  }
  return map;
}

export async function listSubscriptionsForProduct(
  workspaceId: string,
  productId: string,
): Promise<MembershipSubscriptionRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, productId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  type SubRow = (typeof rows)[number];
  const contactIds = [...new Set(rows.map((r: SubRow) => r.contactId))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      })
    : [];
  type ContactRow = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  };
  const contactById = new Map(contacts.map((c: ContactRow) => [c.id, c]));

  return rows.map((row: SubRow) => {
    const contact = contactById.get(row.contactId) as ContactRow | undefined;
    const meta = (row.metadata || {}) as { cancelAtPeriodEnd?: boolean };
    const status =
      meta.cancelAtPeriodEnd && row.status === "active" ? "cancelling" : row.status;
    return {
      id: row.id,
      contactId: row.contactId,
      contactName: contact ? contactDisplayName(contact) : "Customer",
      contactEmail: contact?.email ?? null,
      status,
      startedAt: row.createdAt.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      nextBillingDate: row.currentPeriodEnd?.toISOString() ?? null,
      amountCents: row.product?.priceCents ?? 0,
      cancelAtPeriodEnd: meta.cancelAtPeriodEnd === true,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listMembershipActivityForProduct(
  workspaceId: string,
  productId: string,
): Promise<MembershipActivityRow[]> {
  const prisma = getPrisma();
  const subs = await prisma.serviceMembershipSubscription.findMany({
    where: { workspaceId, productId },
    include: { product: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  type ActivitySubRow = (typeof subs)[number];
  const contactIds = [...new Set(subs.map((s: ActivitySubRow) => s.contactId))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      })
    : [];
  type ActivityContactRow = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  };
  const contactById = new Map(contacts.map((c: ActivityContactRow) => [c.id, c]));

  const events: MembershipActivityRow[] = [];
  for (const sub of subs) {
    const contact = contactById.get(sub.contactId) as ActivityContactRow | undefined;
    const contactName = contact ? contactDisplayName(contact) : "Customer";
    const meta = (sub.metadata || {}) as {
      cancelAtPeriodEnd?: boolean;
      activity?: Array<{ event: string; at: string; status?: string; billingCents?: number }>;
    };
    events.push({
      id: `${sub.id}-joined`,
      contactId: sub.contactId,
      contactName,
      event: "Membership purchased",
      billingCents: sub.product?.priceCents ?? null,
      reference: sub.stripeSubscriptionId,
      status: "Succeeded",
      createdAt: sub.createdAt.toISOString(),
    });
    for (const entry of meta.activity || []) {
      events.push({
        id: `${sub.id}-${entry.at}`,
        contactId: sub.contactId,
        contactName,
        event: entry.event,
        billingCents: entry.billingCents ?? null,
        reference: sub.stripeSubscriptionId,
        status: entry.status || sub.status,
        createdAt: entry.at,
      });
    }
    if (sub.status === "past_due") {
      events.push({
        id: `${sub.id}-past-due`,
        contactId: sub.contactId,
        contactName,
        event: "Past due",
        billingCents: sub.product?.priceCents ?? null,
        reference: sub.stripeSubscriptionId,
        status: "Past due",
        createdAt: sub.updatedAt.toISOString(),
      });
    }
    if (meta.cancelAtPeriodEnd) {
      events.push({
        id: `${sub.id}-cancel-scheduled`,
        contactId: sub.contactId,
        contactName,
        event: "Cancellation scheduled",
        billingCents: null,
        reference: null,
        status: "Cancelling",
        createdAt: sub.updatedAt.toISOString(),
      });
    }
  }
  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

export async function duplicateMembershipProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const source = await prisma.serviceMembershipProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!source) throw new Error("Membership not found");

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let n = 2;
  while (await prisma.serviceMembershipProduct.findFirst({ where: { workspaceId, slug } })) {
    slug = `${baseSlug}-${n}`;
    n += 1;
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
      active: false,
      metadata: source.metadata,
    },
  });
}

export async function deleteMembershipProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const subs = await prisma.serviceMembershipSubscription.count({
    where: { workspaceId, productId },
  });
  if (subs > 0) {
    throw new Error(
      `${subs} customer membership${subs === 1 ? "" : "s"} exist for this product. Deactivate it instead.`,
    );
  }
  await prisma.serviceMembershipProduct.delete({ where: { id: productId, workspaceId } });
  return { deleted: true };
}

export async function upsertMembershipProduct(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    priceCents?: number;
    billingInterval?: string;
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

  if (input.id) {
    const existing = await prisma.serviceMembershipProduct.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Membership not found");
    const data = {
      name: input.name?.trim() || existing.name,
      slug: input.slug || slug || existing.slug,
      description: input.description !== undefined ? input.description : existing.description,
      priceCents: input.priceCents ?? existing.priceCents,
      billingInterval: input.billingInterval ?? existing.billingInterval,
      benefits: input.benefits ?? existing.benefits,
      stripePriceId: input.stripePriceId ?? existing.stripePriceId,
      active: input.active ?? existing.active,
      metadata: input.metadata ?? existing.metadata,
    };
    return prisma.serviceMembershipProduct.update({ where: { id: input.id, workspaceId }, data });
  }

  const data = {
    name: input.name.trim(),
    slug,
    description: input.description,
    priceCents: input.priceCents ?? 0,
    billingInterval: input.billingInterval || "month",
    benefits: input.benefits || {},
    stripePriceId: input.stripePriceId,
    active: input.active ?? true,
    metadata: input.metadata,
  };
  return prisma.serviceMembershipProduct.create({ data: { workspaceId, ...data } });
}

async function appendSubscriptionActivity(
  subscriptionId: string,
  entry: { event: string; status?: string; billingCents?: number },
) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) throw new Error("Subscription not found");
  const meta = (sub.metadata || {}) as {
    activity?: Array<{ event: string; at: string; status?: string; billingCents?: number }>;
  };
  const activity = [...(meta.activity || []), { ...entry, at: new Date().toISOString() }];
  return prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { metadata: { ...meta, activity } },
  });
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

  if (stripeSubscriptionId) {
    const existing = await prisma.serviceMembershipSubscription.findFirst({
      where: { stripeSubscriptionId },
    });
    if (existing) return existing;
  }

  const periodEnd = new Date();
  const interval = product.billingInterval.toLowerCase();
  if (interval === "year" || interval === "annual" || interval === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else if (interval === "quarter" || interval === "quarterly") {
    periodEnd.setMonth(periodEnd.getMonth() + 3);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  return prisma.serviceMembershipSubscription.create({
    data: {
      workspaceId,
      productId,
      contactId,
      status: "active",
      stripeSubscriptionId,
      currentPeriodEnd: periodEnd,
      benefitsSnapshot: product.benefits,
    },
  });
}

export async function markMembershipPastDue(subscriptionId: string) {
  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "past_due" },
  });
  await appendSubscriptionActivity(subscriptionId, {
    event: "Payment failed",
    status: "Past due",
  });
  return row;
}

export async function restoreMembershipSubscription(subscriptionId: string) {
  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "active" },
  });
  await appendSubscriptionActivity(subscriptionId, {
    event: "Recovered",
    status: "Active",
  });
  return row;
}

export async function pauseMembershipProductSubscription(
  subscriptionId: string,
  pausedUntil?: Date,
) {
  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "paused", pausedUntil },
  });
  await appendSubscriptionActivity(subscriptionId, { event: "Paused", status: "Paused" });
  return row;
}

export async function resumeMembershipProductSubscription(subscriptionId: string) {
  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { status: "active", pausedUntil: null },
  });
  await appendSubscriptionActivity(subscriptionId, { event: "Resumed", status: "Active" });
  return row;
}

export async function cancelMembershipProductSubscription(
  subscriptionId: string,
  mode: "immediate" | "end_of_period",
) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) throw new Error("Subscription not found");

  if (mode === "immediate") {
    const row = await prisma.serviceMembershipSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "canceled",
        metadata: {
          ...(sub.metadata as object),
          canceledAt: new Date().toISOString(),
        },
      },
    });
    await appendSubscriptionActivity(subscriptionId, {
      event: "Cancelled",
      status: "Cancelled",
    });
    return row;
  }

  const row = await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: {
      metadata: {
        ...(sub.metadata as object),
        cancelAtPeriodEnd: true,
        cancelRequestedAt: new Date().toISOString(),
      },
    },
  });
  await appendSubscriptionActivity(subscriptionId, {
    event: "Cancellation scheduled",
    status: "Cancelling",
  });
  return row;
}
