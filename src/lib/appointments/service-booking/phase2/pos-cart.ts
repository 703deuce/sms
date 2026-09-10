import "server-only";

import { getPrisma } from "@/lib/db";
import { fulfillStorePurchase } from "@/lib/appointments/service-booking/store-checkout";
import { fulfillBookingProductSale } from "@/lib/appointments/service-booking/booking-products";
import { earnLoyaltyPoints, processReferralOnPosCheckout } from "./loyalty";

export type PosLineItemInput = {
  kind: string;
  description: string;
  quantity?: number;
  unitPriceCents?: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
};

const FULFILLMENT_KINDS = new Set(["package", "gift", "membership", "product"]);

async function recalculateSessionTotals(sessionId: string) {
  const prisma = getPrisma();
  const lineItems = await prisma.posLineItem.findMany({ where: { sessionId } });
  const subtotalCents = lineItems.reduce(
    (sum: number, item: { totalCents: number }) => sum + item.totalCents,
    0,
  );
  const taxCents = 0;
  const totalCents = subtotalCents + taxCents;

  return prisma.posSession.update({
    where: { id: sessionId },
    data: { subtotalCents, taxCents, totalCents },
    include: { lineItems: true },
  });
}

export async function createPosSession(
  workspaceId: string,
  input?: { contactId?: string; staffUserId?: string; metadata?: Record<string, unknown> },
) {
  const prisma = getPrisma();
  return prisma.posSession.create({
    data: {
      workspaceId,
      contactId: input?.contactId,
      staffUserId: input?.staffUserId,
      metadata: input?.metadata,
      status: "open",
    },
    include: { lineItems: true },
  });
}

export async function getPosSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { lineItems: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new Error("POS session not found");
  return session;
}

export async function listOpenPosSessions(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.posSession.findMany({
    where: { workspaceId, status: "open" },
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listRecentPosSessions(workspaceId: string, limit = 8) {
  const prisma = getPrisma();
  return prisma.posSession.findMany({
    where: { workspaceId, status: "checked_out" },
    include: { lineItems: true },
    orderBy: { checkedOutAt: "desc" },
    take: limit,
  });
}

export async function addPosLineItem(
  workspaceId: string,
  sessionId: string,
  input: PosLineItemInput,
) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  const quantity = input.quantity ?? 1;
  const unitPriceCents = input.unitPriceCents ?? 0;
  const totalCents = quantity * unitPriceCents;

  await prisma.posLineItem.create({
    data: {
      sessionId,
      kind: input.kind,
      description: input.description.trim(),
      quantity,
      unitPriceCents,
      totalCents,
      referenceId: input.referenceId,
      metadata: input.metadata,
    },
  });

  return recalculateSessionTotals(sessionId);
}

export async function removePosLineItem(workspaceId: string, sessionId: string, lineItemId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  const line = await prisma.posLineItem.findFirst({
    where: { id: lineItemId, sessionId },
  });
  if (!line) throw new Error("Line item not found");

  await prisma.posLineItem.delete({ where: { id: lineItemId } });
  return recalculateSessionTotals(sessionId);
}

async function recordCouponRedemptionIfNeeded(
  workspaceId: string,
  line: { kind: string; referenceId: string | null; totalCents: number },
  contactId: string,
) {
  if (line.kind !== "discount" || !line.referenceId) return null;
  const prisma = getPrisma();
  const coupon = await prisma.appointmentCoupon.findFirst({
    where: { id: line.referenceId, workspaceId, active: true },
  });
  if (!coupon) return null;

  const existing = await prisma.appointmentCouponRedemption.findFirst({
    where: { couponId: coupon.id, contactId },
  });
  if (existing) return existing.id;

  const redemption = await prisma.appointmentCouponRedemption.create({
    data: {
      couponId: coupon.id,
      contactId,
      amountCents: Math.abs(line.totalCents),
    },
  });
  return redemption.id;
}

export async function checkoutPosSession(
  workspaceId: string,
  sessionId: string,
  input?: {
    contactId?: string;
    referralCode?: string;
    loyaltyProgramId?: string;
    accountCreditCents?: number;
  },
) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
    include: { lineItems: true },
  });
  if (!session) throw new Error("Open POS session not found");
  if (session.lineItems.length === 0) throw new Error("Cannot checkout empty cart");

  const contactId = input?.contactId || session.contactId || undefined;
  const needsContact = session.lineItems.some((line: { kind: string }) =>
    FULFILLMENT_KINDS.has(line.kind),
  );
  if (needsContact && !contactId) {
    throw new Error("A contact is required to fulfill package, gift, membership, or product lines");
  }

  const fulfillment: Array<Record<string, unknown>> = [];

  for (const line of session.lineItems) {
    const meta = (line.metadata || {}) as Record<string, unknown>;
    switch (line.kind) {
      case "package":
      case "gift":
      case "membership": {
        if (!line.referenceId || !contactId) throw new Error(`Missing reference for ${line.kind} line`);
        const result = await fulfillStorePurchase({
          workspaceId,
          kind: line.kind,
          productId: line.referenceId,
          contactId,
          amountCents: line.totalCents > 0 ? line.totalCents : undefined,
          recipientName: typeof meta.recipientName === "string" ? meta.recipientName : undefined,
          recipientEmail: typeof meta.recipientEmail === "string" ? meta.recipientEmail : undefined,
          giftMessage: typeof meta.giftMessage === "string" ? meta.giftMessage : undefined,
        });
        fulfillment.push({ lineId: line.id, kind: line.kind, result });
        break;
      }
      case "product": {
        if (!line.referenceId || !contactId) throw new Error("Missing product reference");
        const result = await fulfillBookingProductSale(workspaceId, {
          productId: line.referenceId,
          contactId,
          quantity: line.quantity,
        });
        fulfillment.push({ lineId: line.id, kind: line.kind, result });
        break;
      }
      case "discount": {
        if (contactId) {
          const redemptionId = await recordCouponRedemptionIfNeeded(workspaceId, line, contactId);
          fulfillment.push({ lineId: line.id, kind: line.kind, redemptionId });
        }
        break;
      }
      case "service":
      case "appointment": {
        fulfillment.push({
          lineId: line.id,
          kind: line.kind,
          typeId: line.referenceId,
          totalCents: line.totalCents,
          recorded: true,
        });
        break;
      }
      case "tip":
      case "custom":
        fulfillment.push({ lineId: line.id, kind: line.kind, totalCents: line.totalCents });
        break;
      default:
        fulfillment.push({ lineId: line.id, kind: line.kind, skipped: true });
    }
  }

  if (contactId && input?.referralCode) {
    await processReferralOnPosCheckout(workspaceId, {
      referralCode: input.referralCode,
      referredContactId: contactId,
      spendCents: Math.max(0, session.totalCents),
    });
  }

  if (contactId && input?.loyaltyProgramId && session.totalCents > 0) {
    await earnLoyaltyPoints(workspaceId, input.loyaltyProgramId, contactId, {
      spendCents: session.totalCents,
      note: `POS session ${sessionId}`,
    });
  } else if (contactId && session.totalCents > 0) {
    const program = await prisma.loyaltyProgram.findFirst({
      where: { workspaceId, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (program) {
      await earnLoyaltyPoints(workspaceId, program.id, contactId, {
        spendCents: session.totalCents,
        note: `POS session ${sessionId}`,
      });
    }
  }

  let accountCreditApplied = 0;
  if (contactId && input?.accountCreditCents && input.accountCreditCents > 0) {
    const { debitWallet } = await import("./client-wallet");
    const applyCents = Math.min(input.accountCreditCents, session.totalCents);
    if (applyCents > 0) {
      await debitWallet(workspaceId, contactId, applyCents, {
        note: `POS session ${sessionId}`,
        referenceId: sessionId,
        kind: "pos_payment",
      });
      accountCreditApplied = applyCents;
    }
  }

  const priorMeta = (session.metadata || {}) as Record<string, unknown>;
  return prisma.posSession.update({
    where: { id: sessionId },
    data: {
      status: "checked_out",
      checkedOutAt: new Date(),
      contactId: contactId || session.contactId,
      metadata: {
        ...priorMeta,
        fulfillment,
        accountCreditAppliedCents: accountCreditApplied,
        taxBackendGap: true,
      },
    },
    include: { lineItems: true },
  });
}

export async function voidPosSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  return prisma.posSession.update({
    where: { id: sessionId },
    data: { status: "void" },
    include: { lineItems: true },
  });
}
