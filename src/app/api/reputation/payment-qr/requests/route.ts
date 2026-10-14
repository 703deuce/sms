import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createPaymentRequestSession } from "@/lib/reputation/payment-qr/service";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      qrCampaignId?: string;
      amountCents?: number;
      currency?: string;
      note?: string | null;
      expiresInDays?: number;
    };

    if (!body.businessId || !body.qrCampaignId || !body.amountCents) {
      return NextResponse.json(
        { error: "businessId, qrCampaignId, and amountCents are required." },
        { status: 400 }
      );
    }

    const auth = await requireBusinessAccess(body.businessId);
    const rate = await assertRateLimit({
      key: `payment-request-create:${auth.organizationId}`,
      maxPerWindow: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many payment requests created." }, { status: 429 });
    }

    const result = await createPaymentRequestSession({
      organizationId: auth.organizationId,
      businessId: body.businessId,
      qrCampaignId: body.qrCampaignId,
      ownerUserId: auth.userId,
      amountCents: body.amountCents,
      currency: body.currency,
      note: body.note,
      expiresInDays: body.expiresInDays,
    });

    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Failed to create payment request");
  }
}
