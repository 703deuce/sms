import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { markPaymentLinkPaidById } from "@/lib/payments/create-link";

type Ctx = { params: Promise<{ linkId: string }> };

/**
 * Dev/demo checkout confirmation when Stripe is not configured.
 * Marks the payment link paid and propagates payment_received facts.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const { linkId } = await ctx.params;
  const prisma = getPrisma();
  const row = await prisma.paymentLink.findUnique({ where: { id: linkId } });
  if (!row) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }
  if (row.stripeSessionId) {
    return NextResponse.json(
      { error: "This link uses Stripe Checkout — complete payment there." },
      { status: 400 },
    );
  }

  const updated = await markPaymentLinkPaidById(linkId);
  return NextResponse.json({
    data: updated
      ? {
          id: updated.id,
          amountCents: updated.amountCents,
          currency: updated.currency,
          description: updated.description,
          status: updated.status,
        }
      : null,
  });
}
