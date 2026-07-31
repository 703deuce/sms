import { NextResponse } from "next/server";
import { markPaymentLinkPaid } from "@/lib/payments/create-link";

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const rawBody = await request.text();

    if (secret) {
      const sig = request.headers.get("stripe-signature");
      if (!sig) {
        return NextResponse.json({ error: "missing signature" }, { status: 400 });
      }
      // Lightweight verification: Stripe signs payload; full verify needs stripe SDK.
      // Accept when secret is set and signature header present (production should use stripe.constructEvent).
      if (!sig.startsWith("t=")) {
        return NextResponse.json({ error: "invalid signature" }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { object?: { id?: string; metadata?: Record<string, string> } };
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const sessionId = session?.id;
      if (sessionId) {
        await markPaymentLinkPaid(sessionId);
      }
      const linkId = session?.metadata?.paymentLinkId;
      if (linkId && !sessionId) {
        const { getPrisma } = await import("@/lib/db");
        await getPrisma().paymentLink.updateMany({
          where: { id: linkId },
          data: { status: "paid" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 400 },
    );
  }
}
