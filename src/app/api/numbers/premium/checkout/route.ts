import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError, requireWorkspaceFeature } from "@/lib/api-auth";
import { createPremiumNumberCheckoutSessionFromReservation } from "@/lib/payments/stripe-premium-number-checkout";
import { isNumberTestPaymentMode } from "@/lib/payments/number-payment-provider";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    reservationId?: string;
    successUrl?: string;
    cancelUrl?: string;
  } | null;

  const reservationId = String(body?.reservationId || "").trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  try {
    const purchaseAuth = await requireWorkspaceFeature("buy_number");
    if ("error" in purchaseAuth) return purchaseAuth.error;

    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);

    if (isNumberTestPaymentMode()) {
      return NextResponse.json(
        {
          error: "Stripe checkout unavailable in test payment mode. Use /api/numbers/premium/complete.",
          testPayment: true,
        },
        { status: 409 },
      );
    }

    const session = await createPremiumNumberCheckoutSessionFromReservation({
      workspaceId,
      userId: auth.session.userId,
      reservationId,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      amountCents: session.amountCents,
      oneTime: true,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
