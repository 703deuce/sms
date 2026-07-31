import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  addMockCredits,
  createBillingPortalSession,
  createCreditsCheckoutSession,
  createSubscriptionCheckoutSession,
  getBillingSummary,
} from "@/lib/settings/billing";
import { isStripeConfigured } from "@/lib/stripe/client";
import { loadDashboardMetrics, loadUsage } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [metrics, usage, billing] = await Promise.all([
      loadDashboardMetrics(auth.workspaceId),
      loadUsage(auth.workspaceId),
      getBillingSummary(auth.workspaceId),
    ]);

    return NextResponse.json({
      data: {
        metrics,
        usage,
        billing,
        ledger: billing.ledger,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      amountCents?: number;
      action?: string;
      plan?: string;
      priceId?: string;
    };

    if (body.action === "stripe_portal") {
      if (!isStripeConfigured()) {
        return NextResponse.json({ error: "Stripe billing not configured" }, { status: 400 });
      }
      const { url } = await createBillingPortalSession(auth.workspaceId);
      return NextResponse.json({ url });
    }

    if (body.action === "checkout_subscription") {
      if (!isStripeConfigured()) {
        return NextResponse.json({ error: "Stripe billing not configured" }, { status: 400 });
      }
      const priceIdOrPlan = (body.priceId || body.plan || "").trim();
      if (!priceIdOrPlan) {
        return NextResponse.json({ error: "plan or priceId is required" }, { status: 400 });
      }
      const { url } = await createSubscriptionCheckoutSession(auth.workspaceId, priceIdOrPlan);
      return NextResponse.json({ url });
    }

    // Credit top-up: real Stripe checkout when configured, mock ledger otherwise.
    const amountCents = Number(body.amountCents || 5000);
    if (amountCents < 1000) {
      return NextResponse.json({ error: "Minimum purchase is $10" }, { status: 400 });
    }

    if (isStripeConfigured()) {
      const { url } = await createCreditsCheckoutSession(auth.workspaceId, amountCents);
      return NextResponse.json({ url });
    }

    const entry = await addMockCredits(auth.workspaceId, amountCents);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
