import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  addMockCredits,
  getCreditLedger,
  getStripePortalUrl,
} from "@/lib/settings/billing";
import { loadDashboardMetrics, loadUsage } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [metrics, usage, ledger, stripePortalUrl] = await Promise.all([
      loadDashboardMetrics(auth.workspaceId),
      loadUsage(auth.workspaceId),
      getCreditLedger(auth.workspaceId),
      Promise.resolve(getStripePortalUrl(auth.workspaceId)),
    ]);

    return NextResponse.json({
      data: {
        metrics,
        usage,
        ledger,
        stripePortalUrl,
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

    const body = (await request.json()) as { amountCents?: number; action?: string };
    if (body.action === "stripe_portal") {
      const url = getStripePortalUrl(auth.workspaceId);
      if (!url) {
        return NextResponse.json({ error: "Stripe billing not configured" }, { status: 400 });
      }
      return NextResponse.json({ url });
    }

    const amountCents = Number(body.amountCents || 5000);
    if (amountCents < 1000) {
      return NextResponse.json({ error: "Minimum purchase is $10" }, { status: 400 });
    }

    const entry = await addMockCredits(auth.workspaceId, amountCents);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
