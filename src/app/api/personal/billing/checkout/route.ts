import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { createMarketplaceServiceCheckoutSession } from "@/lib/payments/stripe-service-subscription-checkout";
import type { MarketplaceServiceKey } from "@/lib/payments/stripe-marketplace-metadata";

const VALID_SERVICES = new Set<MarketplaceServiceKey>(["vault", "voicemail", "forwarding_200"]);

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    phoneNumberId?: string;
    service?: string;
    successUrl?: string;
    cancelUrl?: string;
  } | null;

  const phoneNumberId = String(body?.phoneNumberId || "").trim();
  const service = String(body?.service || "").trim() as MarketplaceServiceKey;
  if (!phoneNumberId || !VALID_SERVICES.has(service)) {
    return NextResponse.json({ error: "phoneNumberId and valid service required" }, { status: 400 });
  }

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const prisma = getPrisma();
    const owned = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId },
    });
    if (!owned) {
      return NextResponse.json({ error: "Number not found" }, { status: 404 });
    }

    const session = await createMarketplaceServiceCheckoutSession({
      workspaceId,
      userId: auth.session.userId,
      phoneNumberId,
      service,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });

    const product = await prisma.marketplaceBillingProduct.findUnique({ where: { productKey: service } });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      service,
      amountCents: product?.amountCents ?? null,
      recurring: true,
      includedUsageMinutes: product?.includedUsageMinutes ?? null,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
