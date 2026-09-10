import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";
import {
  attachSavedPaymentMethod,
  createSavedCardSetupIntent,
  getSavedPaymentMethodForContact,
} from "@/lib/merchant-payments/saved-cards";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });

    const saved = await getSavedPaymentMethodForContact(
      resolved.session.workspaceId,
      resolved.session.contactId,
    );

    let card: { brand?: string; last4?: string; expMonth?: number; expYear?: number } | null = null;
    if (saved?.defaultPaymentMethodId && saved.stripeCustomerId) {
      try {
        const { getStripe } = await import("@/lib/stripe/client");
        const { getMerchantConnection } = await import("@/lib/merchant-payments/connection-store");
        const stripe = getStripe();
        const connection = await getMerchantConnection(resolved.session.workspaceId, "STRIPE");
        if (stripe && connection?.merchantAccountId) {
          const pm = await stripe.paymentMethods.retrieve(
            saved.defaultPaymentMethodId,
            {},
            { stripeAccount: connection.merchantAccountId },
          );
          if (pm.card) {
            card = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }
      } catch {
        card = null;
      }
    }

    return NextResponse.json({
      data: {
        hasSavedCard: Boolean(saved?.defaultPaymentMethodId),
        paymentMethodId: saved?.defaultPaymentMethodId || null,
        card,
        providerConfigured: Boolean(saved?.stripeCustomerId),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });

    const body = (await request.json()) as { action?: string; paymentMethodId?: string };
    const action = String(body.action || "setup");

    if (action === "setup") {
      const result = await createSavedCardSetupIntent({
        workspaceId: resolved.session.workspaceId,
        contactId: resolved.session.contactId,
      });
      return NextResponse.json({ data: result });
    }

    if (action === "attach") {
      const paymentMethodId = String(body.paymentMethodId || "");
      if (!paymentMethodId) {
        return NextResponse.json({ error: "paymentMethodId required" }, { status: 400 });
      }
      const result = await attachSavedPaymentMethod({
        workspaceId: resolved.session.workspaceId,
        contactId: resolved.session.contactId,
        paymentMethodId,
      });
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
