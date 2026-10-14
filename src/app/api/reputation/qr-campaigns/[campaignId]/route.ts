import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import {
  getQrCampaignForBusiness,
  updateQrCampaign,
  duplicateQrCampaign,
  buildQrTrackedUrl,
} from "@/lib/reputation/qr-campaigns";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    const campaign = await getQrCampaignForBusiness({
      campaignId,
      businessId,
      organizationId: auth.organizationId,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      campaign,
      trackedUrl: buildQrTrackedUrl(campaign.shortCode),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load QR campaign");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = (await request.json()) as {
      businessId?: string;
      patch?: Record<string, unknown>;
    };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(body.businessId);
    const rate = await assertRateLimit({
      key: `qr-campaign-edit:${auth.organizationId}`,
      maxPerWindow: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many edits." }, { status: 429 });
    }

    const campaign = await updateQrCampaign({
      campaignId,
      businessId: body.businessId,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      patch: (body.patch ?? {}) as never,
    });

    return NextResponse.json({
      campaign,
      trackedUrl: buildQrTrackedUrl(campaign.shortCode),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update QR campaign");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = (await request.json()) as { businessId?: string; action?: string };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(body.businessId);

    if (body.action === "duplicate") {
      const campaign = await duplicateQrCampaign({
        campaignId,
        businessId: body.businessId,
        organizationId: auth.organizationId,
        ownerUserId: auth.userId,
      });
      trackProductEvent("qr_campaign_duplicated", {
        organizationId: auth.organizationId,
        businessId: body.businessId,
        campaignId: campaign.id,
      });
      return NextResponse.json({
        campaign,
        trackedUrl: buildQrTrackedUrl(campaign.shortCode),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return httpErrorFromException(err, "Failed to process QR campaign action");
  }
}
