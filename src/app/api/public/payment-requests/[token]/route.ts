import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import {
  recordPaymentRequestOpen,
  resolvePublicPaymentRequest,
} from "@/lib/payment-requests/service";
import { formatMoneyMinor } from "@/lib/payment-requests/format";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const resolved = await resolvePublicPaymentRequest(token);

  if (resolved.kind === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accept = request.headers.get("accept") || "";
  const wantsJson = accept.includes("application/json");

  if (resolved.kind === "cancelled") {
    if (wantsJson) {
      return NextResponse.json({ state: "cancelled" });
    }
    return new NextResponse(cancelledHtml(), {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (resolved.kind === "expired") {
    if (wantsJson) {
      return NextResponse.json({ state: "expired" });
    }
    return new NextResponse(expiredHtml(), {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (resolved.kind === "paid") {
    const amount = formatMoneyMinor(
      resolved.row.amountPaidMinor ?? resolved.row.amountMinor,
      resolved.row.currency,
    );
    if (wantsJson) {
      return NextResponse.json({ state: "paid", amount });
    }
    return new NextResponse(paidHtml(amount), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  await recordPaymentRequestOpen(token);
  const checkoutId = resolved.row.processorCheckoutId;
  if (!checkoutId) {
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe || !resolved.row.processorConnectedAccountId) {
    return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  }

  const session = await stripe.checkout.sessions.retrieve(
    checkoutId,
    {},
    { stripeAccount: resolved.row.processorConnectedAccountId },
  );

  if (!session.url) {
    return NextResponse.json({ error: "Checkout link expired" }, { status: 410 });
  }

  return NextResponse.redirect(session.url, 302);
}

function shell(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f6f6f4;color:#111;margin:0;padding:48px 20px;display:flex;justify-content:center}main{max-width:420px;background:#fff;border:1px solid #e8e8e6;border-radius:10px;padding:28px 24px}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#555;font-size:14px;line-height:1.5}</style></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
}

function cancelledHtml() {
  return shell(
    "Payment request inactive",
    "<p>This payment request is no longer active. Contact the business if you need a new payment request.</p>",
  );
}

function expiredHtml() {
  return shell(
    "Payment request expired",
    "<p>This payment request has expired. Contact the business for a new payment request.</p>",
  );
}

function paidHtml(amount: string) {
  return shell("Payment already received", `<p>We already received ${amount} for this request.</p>`);
}
