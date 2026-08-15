import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError, requireWorkspaceFeature } from "@/lib/api-auth";
import { completePremiumPurchase } from "@/lib/numbers/purchase-service";
import { isNumberTestPaymentMode } from "@/lib/payments/number-payment-provider";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    reservationId?: string;
    idempotencyKey?: string;
    dryRun?: boolean;
  } | null;

  const reservationId = String(body?.reservationId || "").trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  try {
    const purchaseAuth = await requireWorkspaceFeature("buy_number");
    if ("error" in purchaseAuth) return purchaseAuth.error;

    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const dryRun =
      body?.dryRun === true || process.env.NUMBER_SKIP_TELNYX_PURCHASE?.trim() === "1";

    const result = await completePremiumPurchase({
      workspaceId,
      userId: auth.session.userId,
      reservationId,
      idempotencyKey: body?.idempotencyKey,
      dryRunProviderPurchase: dryRun,
    });

    if (!result.ok) {
      const status =
        result.status === "not_found"
          ? 404
          : result.status === "reservation_expired" || result.status === "reservation_invalid"
            ? 409
            : result.status === "provider_failed"
              ? 502
              : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      ...result,
      testPayment: isNumberTestPaymentMode(),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
