import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listMarketplaceBillingCatalog } from "@/lib/payments/marketplace-billing-catalog";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(auth.session, url.searchParams.get("workspaceId") ?? undefined);
    const phoneNumberId = url.searchParams.get("phoneNumberId")?.trim() || undefined;
    const prisma = getPrisma();

    const subscriptions = await prisma.numberServiceSubscription.findMany({
      where: {
        workspaceId,
        userId: auth.session.userId,
        ...(phoneNumberId ? { phoneNumberId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        product: true,
        phoneNumber: { select: { id: true, e164: true, friendlyName: true } },
      },
    });

    const catalog = await listMarketplaceBillingCatalog();

    return NextResponse.json({
      subscriptions: subscriptions.map((row) => ({
        id: row.id,
        phoneNumberId: row.phoneNumberId,
        phoneNumber: row.phoneNumber.e164,
        service: row.productKey,
        displayName: row.product.displayName,
        amountCents: row.product.amountCents,
        status: row.status,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        currentPeriodEnd: row.currentPeriodEnd,
        includedMinutesPerPeriod: row.includedMinutesPerPeriod,
        minutesUsedThisPeriod: row.minutesUsedThisPeriod,
        active: ["active", "trialing", "past_due"].includes(row.status),
      })),
      catalog: catalog.map((row) => ({
        productKey: row.productKey,
        displayName: row.displayName,
        description: row.description,
        amountCents: row.amountCents,
        includedUsageMinutes: row.includedUsageMinutes,
        monthlyPriceLabel: `$${(row.amountCents / 100).toFixed(2)}/month`,
      })),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
