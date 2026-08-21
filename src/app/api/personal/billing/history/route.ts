import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(auth.session, url.searchParams.get("workspaceId") ?? undefined);
    const prisma = getPrisma();

    const [numberPurchases, serviceSubscriptions, refunds] = await Promise.all([
      prisma.premiumNumberReservation.findMany({
        where: { workspaceId, userId: auth.session.userId, paymentStatus: { not: "none" } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          phoneNumber: true,
          vanityDisplay: true,
          displayNumber: true,
          premiumPriceCents: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          orderStatus: true,
          stripeSessionId: true,
          stripeRefundId: true,
          phoneNumberId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.numberServiceSubscription.findMany({
        where: { workspaceId, userId: auth.session.userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { product: true, phoneNumber: { select: { id: true, e164: true, friendlyName: true } } },
      }),
      prisma.marketplaceStripeRefund.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      numberPurchases: numberPurchases.map((row: (typeof numberPurchases)[number]) => ({
        type: "number_purchase" as const,
        reservationId: row.id,
        phoneNumber: row.phoneNumber,
        display: row.vanityDisplay || row.displayNumber || row.phoneNumber,
        amountCents: row.premiumPriceCents,
        paymentStatus: row.paymentStatus,
        fulfillmentStatus: row.fulfillmentStatus,
        refundId: row.stripeRefundId,
        phoneNumberId: row.phoneNumberId,
        purchasedAt: row.updatedAt,
      })),
      serviceSubscriptions: serviceSubscriptions.map((row: (typeof serviceSubscriptions)[number]) => ({
        type: "service_subscription" as const,
        id: row.id,
        service: row.productKey,
        displayName: row.product.displayName,
        phoneNumberId: row.phoneNumberId,
        phoneNumber:
          (row.phoneNumber as { e164?: string; number?: string }).e164 ??
          (row.phoneNumber as { number?: string }).number ??
          "",
        amountCents: row.product.amountCents,
        status: row.status,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        currentPeriodEnd: row.currentPeriodEnd,
        includedMinutesPerPeriod: row.includedMinutesPerPeriod,
        minutesUsedThisPeriod: row.minutesUsedThisPeriod,
      })),
      refunds,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
