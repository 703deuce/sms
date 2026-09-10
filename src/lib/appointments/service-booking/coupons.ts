import "server-only";

import { getPrisma } from "@/lib/db";

export async function listCoupons(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.appointmentCoupon.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertCoupon(
  workspaceId: string,
  input: {
    id?: string;
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    startsAt?: string;
    expiresAt?: string;
    usageCap?: number;
    onePerCustomer?: boolean;
    eligibleTargets?: Record<string, unknown>;
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const data = {
    code: input.code.trim().toUpperCase(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    usageCap: input.usageCap,
    onePerCustomer: input.onePerCustomer ?? false,
    eligibleTargets: input.eligibleTargets || {},
    active: input.active ?? true,
  };
  if (input.id) {
    return prisma.appointmentCoupon.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.appointmentCoupon.create({ data: { workspaceId, ...data } });
}

export async function validateAndApplyCoupon(
  workspaceId: string,
  code: string,
  input: { contactId?: string; baseCents: number; targetKind?: string; targetId?: string },
) {
  const prisma = getPrisma();
  const coupon = await prisma.appointmentCoupon.findFirst({
    where: { workspaceId, code: code.trim().toUpperCase(), active: true },
  });
  if (!coupon) throw new Error("Invalid coupon");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new Error("Coupon not active yet");
  if (coupon.expiresAt && coupon.expiresAt < now) throw new Error("Coupon expired");

  if (coupon.usageCap != null) {
    const used = await prisma.appointmentCouponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= coupon.usageCap) throw new Error("Coupon usage limit reached");
  }

  if (coupon.onePerCustomer && input.contactId) {
    const prior = await prisma.appointmentCouponRedemption.findFirst({
      where: { couponId: coupon.id, contactId: input.contactId },
    });
    if (prior) throw new Error("Coupon already used");
  }

  const discountCents =
    coupon.discountType === "percent"
      ? Math.round((input.baseCents * coupon.discountValue) / 100)
      : Math.min(input.baseCents, coupon.discountValue);

  const redemption = await prisma.appointmentCouponRedemption.create({
    data: {
      couponId: coupon.id,
      contactId: input.contactId,
      amountCents: discountCents,
    },
  });

  return { coupon, discountCents, redemptionId: redemption.id, totalCents: input.baseCents - discountCents };
}

export async function getCouponUsageSummary(workspaceId: string, couponId: string) {
  const prisma = getPrisma();
  const coupon = await prisma.appointmentCoupon.findFirst({
    where: { id: couponId, workspaceId },
  });
  if (!coupon) throw new Error("Discount not found");
  const used = await prisma.appointmentCouponRedemption.count({ where: { couponId } });
  return {
    used,
    remaining: coupon.usageCap != null ? Math.max(0, coupon.usageCap - used) : null,
  };
}

export async function duplicateCoupon(workspaceId: string, couponId: string) {
  const prisma = getPrisma();
  const source = await prisma.appointmentCoupon.findFirst({
    where: { id: couponId, workspaceId },
  });
  if (!source) throw new Error("Discount not found");
  const base = `${source.code}COPY`.slice(0, 18);
  let code = base;
  let n = 1;
  while (await prisma.appointmentCoupon.findFirst({ where: { workspaceId, code } })) {
    code = `${base}${n++}`.slice(0, 20);
  }
  return prisma.appointmentCoupon.create({
    data: {
      workspaceId,
      code,
      discountType: source.discountType,
      discountValue: source.discountValue,
      startsAt: source.startsAt,
      expiresAt: source.expiresAt,
      usageCap: source.usageCap,
      onePerCustomer: source.onePerCustomer,
      eligibleTargets: source.eligibleTargets,
      active: false,
      metadata: source.metadata,
    },
  });
}
