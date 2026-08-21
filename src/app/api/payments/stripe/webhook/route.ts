import { handleStripeWebhookRequest } from "@/lib/payments/stripe-webhook-handler";

/**
 * Legacy alias — production should use /api/webhooks/stripe.
 * Kept so existing Stripe Dashboard configs keep working during migration.
 */
export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}

export async function GET() {
  return Response.json({ ok: true, service: "stripe-webhook-legacy", canonical: "/api/webhooks/stripe" });
}
