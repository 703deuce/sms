import "server-only";

import { getPrisma } from "@/lib/db";
import type { MembershipBenefits, PackageCreditRule } from "./types";
import { membershipEntitlementsActive } from "./membership-lifecycle";

export type MembershipPriceAdjustment = {
  adjustedPriceCents: number;
  discountCents: number;
  benefitKind: "included" | "discount" | "none";
  membershipSubscriptionId?: string;
  membershipProductName?: string;
};

function periodUsageKey(currentPeriodEnd: Date | null | undefined): string {
  if (!currentPeriodEnd) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;
  }
  return currentPeriodEnd.toISOString().slice(0, 10);
}

function usageCounts(metadata: unknown): Record<string, number> {
  const meta = (metadata || {}) as {
    usage?: { periodKey?: string; counts?: Record<string, number> };
  };
  return meta.usage?.counts || {};
}

function includedCreditAllowance(
  benefits: MembershipBenefits,
  bookingTypeId: string,
): PackageCreditRule | null {
  const rules = benefits.includedCredits || [];
  return (
    rules.find((rule) => rule.bookingTypeId === bookingTypeId && (rule.quantity || 0) > 0) ||
    null
  );
}

export async function resolveMembershipPriceAdjustment(input: {
  workspaceId: string;
  contactId: string;
  bookingTypeId: string;
  basePriceCents: number;
}): Promise<MembershipPriceAdjustment> {
  if (!input.contactId || input.basePriceCents <= 0) {
    return {
      adjustedPriceCents: input.basePriceCents,
      discountCents: 0,
      benefitKind: "none",
    };
  }

  const prisma = getPrisma();
  const subscriptions = await prisma.serviceMembershipSubscription.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: { in: ["active", "trialing"] },
    },
    include: { product: true },
  });

  let best: MembershipPriceAdjustment = {
    adjustedPriceCents: input.basePriceCents,
    discountCents: 0,
    benefitKind: "none",
  };

  for (const sub of subscriptions) {
    if (!membershipEntitlementsActive(sub.status)) continue;
    const benefits = ((sub.product?.benefits || sub.benefitsSnapshot || {}) as MembershipBenefits);
    const typeIds = benefits.memberOnlyTypeIds || [];
    const grantsIncluded = typeIds.includes(input.bookingTypeId);

    if (grantsIncluded) {
      return {
        adjustedPriceCents: 0,
        discountCents: input.basePriceCents,
        benefitKind: "included",
        membershipSubscriptionId: sub.id,
        membershipProductName: sub.product?.name,
      };
    }

    const creditRule = includedCreditAllowance(benefits, input.bookingTypeId);
    if (creditRule) {
      const counts = usageCounts(sub.metadata);
      const used = counts[input.bookingTypeId] || 0;
      if (used < (creditRule.quantity || 0)) {
        return {
          adjustedPriceCents: 0,
          discountCents: input.basePriceCents,
          benefitKind: "included",
          membershipSubscriptionId: sub.id,
          membershipProductName: sub.product?.name,
        };
      }
    }

    let discounted = input.basePriceCents;
    if (benefits.percentDiscount && benefits.percentDiscount > 0) {
      discounted = Math.max(
        0,
        Math.round(input.basePriceCents * (1 - benefits.percentDiscount / 100)),
      );
    }
    if (benefits.fixedDiscountCents && benefits.fixedDiscountCents > 0) {
      discounted = Math.max(0, input.basePriceCents - benefits.fixedDiscountCents);
    }

    if (discounted < best.adjustedPriceCents) {
      best = {
        adjustedPriceCents: discounted,
        discountCents: input.basePriceCents - discounted,
        benefitKind: "discount",
        membershipSubscriptionId: sub.id,
        membershipProductName: sub.product?.name,
      };
    }
  }

  return best;
}

export async function markAppointmentPaidByMembership(
  workspaceId: string,
  appointmentId: string,
  detail: {
    amountCentsWaived: number;
    subscriptionId: string;
    productName?: string;
    benefitKind: "included" | "discount";
  },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;

  const { appendTimeline } = await import("@/lib/appointments/settings");
  const meta = (row.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: row.status === "pending_payment" ? "awaiting_confirmation" : row.status,
      metadata: appendTimeline(
        {
          ...meta,
          paymentStatus: "succeeded",
          paymentProvider: "membership",
          paymentAmountCents: detail.amountCentsWaived,
          membershipBenefit: {
            subscriptionId: detail.subscriptionId,
            productName: detail.productName,
            benefitKind: detail.benefitKind,
            amountCentsWaived: detail.amountCentsWaived,
          },
        },
        {
          type: "membership_payment",
          label: `Paid with membership${detail.productName ? ` (${detail.productName})` : ""}`,
        },
      ) as object,
    },
  });
}

export async function recordMembershipBookingUsage(input: {
  subscriptionId: string;
  bookingTypeId: string;
  appointmentId: string;
  benefitKind: "included" | "discount";
}) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findUnique({
    where: { id: input.subscriptionId },
    include: { product: true },
  });
  if (!sub) return;

  const benefits = (sub.product?.benefits || sub.benefitsSnapshot || {}) as MembershipBenefits;
  const creditRule = includedCreditAllowance(benefits, input.bookingTypeId);
  const meta = (sub.metadata || {}) as {
    usage?: { periodKey?: string; counts?: Record<string, number> };
    activity?: Array<{ event: string; at: string; status?: string }>;
  };
  const periodKey = periodUsageKey(sub.currentPeriodEnd);
  const usage = meta.usage?.periodKey === periodKey
    ? { ...(meta.usage?.counts || {}) }
    : {};
  if (creditRule) {
    usage[input.bookingTypeId] = (usage[input.bookingTypeId] || 0) + 1;
  }

  const activity = [
    ...(meta.activity || []),
    {
      event: input.benefitKind === "included" ? "Access used" : "Member discount applied",
      at: new Date().toISOString(),
      status: "Succeeded",
    },
  ];

  await prisma.serviceMembershipSubscription.update({
    where: { id: input.subscriptionId },
    data: {
      metadata: {
        ...meta,
        usage: { periodKey, counts: usage },
        activity,
        lastBookingId: input.appointmentId,
      },
    },
  });
}
