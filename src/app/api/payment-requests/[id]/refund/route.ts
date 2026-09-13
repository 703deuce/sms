import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { refundPaymentRequest } from "@/lib/payment-requests/refunds";
import { parseAmountToMinor } from "@/lib/payment-requests/format";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const amountMinor =
      typeof body.amountMinor === "number"
        ? body.amountMinor
        : body.amount
          ? parseAmountToMinor(String(body.amount))
          : undefined;

    const result = await refundPaymentRequest({
      workspaceId,
      paymentRequestId: id,
      amountMinor,
      reason: body.reason ? String(body.reason) : undefined,
      userId: auth.session.userId,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
