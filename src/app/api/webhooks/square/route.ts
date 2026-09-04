import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { recordWebhookEvent, markWebhookProcessed } from "@/lib/merchant-payments/webhook-idempotency";
import { handleSquareWebhookPayment } from "@/lib/merchant-payments/square";

function verifySquareSignature(body: string, signature: string, url: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!key) return process.env.NODE_ENV !== "production";

  const payload = url + body;
  const hmac = createHmac("sha256", key).update(payload).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  const url = request.url;

  if (!verifySquareSignature(rawBody, signature, url)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    event_id: string;
    data?: unknown;
  };

  const { duplicate, id } = await recordWebhookEvent({
    provider: "square",
    eventType: event.type,
    providerEventId: event.event_id,
    payload: event,
  });

  if (duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "payment.updated" || event.type === "payment.created") {
      await handleSquareWebhookPayment(event as {
        type: string;
        data?: { object?: { payment?: { id: string; status: string; reference_id?: string; amount_money?: { amount: number } } } };
      });
    }
    await markWebhookProcessed(id);
    return NextResponse.json({ received: true });
  } catch (err) {
    await markWebhookProcessed(id, err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "square-webhook" });
}
