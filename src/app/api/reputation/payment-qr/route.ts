import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createPaymentQrCampaign } from "@/lib/reputation/payment-qr/service";
import { getPaymentConfigByCampaignId } from "@/lib/reputation/payment-qr/service";
import { getPaymentQrEntitlements } from "@/lib/reputation/payment-qr/entitlements";
import { getQrCampaignForBusiness } from "@/lib/reputation/qr-campaigns";
import { buildQrTrackedUrl } from "@/lib/reputation/qr-campaigns";
import { buildPaymentPageUrl } from "@/lib/reputation/payment-qr/service";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import type { CreatePaymentQrInput } from "@/lib/reputation/payment-qr/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePaymentQrInput & { businessId?: string };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(body.businessId);
    const rate = await assertRateLimit({
      key: `payment-qr-create:${auth.organizationId}`,
      maxPerWindow: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many payment pages created." }, { status: 429 });
    }

    const { campaign, config } = await createPaymentQrCampaign({
      ...body,
      organizationId: auth.organizationId,
      businessId: body.businessId,
      ownerUserId: auth.userId,
    });

    const slug = campaign.publicSlug ?? campaign.shortCode;
    const entitlements = await getPaymentQrEntitlements(auth.organizationId);

    return NextResponse.json({
      campaign,
      config,
      trackedUrl: buildQrTrackedUrl(campaign.shortCode),
      publicPageUrl: buildPaymentPageUrl(slug),
      entitlements,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create payment QR campaign");
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    const campaignId = url.searchParams.get("campaignId");
    const entitlements = await getPaymentQrEntitlements(auth.organizationId);

    if (campaignId) {
      const campaign = await getQrCampaignForBusiness({
        campaignId,
        businessId,
        organizationId: auth.organizationId,
      });
      if (!campaign || campaign.campaignType !== "payment_review") {
        return NextResponse.json({ error: "Payment campaign not found" }, { status: 404 });
      }
      const config = await getPaymentConfigByCampaignId(campaignId);
      if (!config) {
        return NextResponse.json({ error: "Payment configuration not found" }, { status: 404 });
      }
      const slug = campaign.publicSlug ?? campaign.shortCode;
      return NextResponse.json({
        campaign,
        config,
        entitlements,
        publicPageUrl: buildPaymentPageUrl(slug),
        permanentPageUrl: slug ? buildPaymentPageUrl(slug) : null,
      });
    }

    return NextResponse.json({ entitlements });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load payment QR entitlements");
  }
}
