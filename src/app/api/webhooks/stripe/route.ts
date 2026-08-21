import { handleStripeWebhookRequest } from "@/lib/payments/stripe-webhook-handler";

/**
 * Canonical production Stripe webhook endpoint.
 * Handles subscription/billing, text-to-pay links, credits, and premium number purchases.
 */
export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}

export async function GET() {
  return Response.json({ ok: true, service: "stripe-webhook" });
}
