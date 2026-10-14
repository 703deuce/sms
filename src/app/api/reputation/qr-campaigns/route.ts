import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import {
  createQrCampaign,
  listQrCampaigns,
  getDefaultOrMigrateQrCampaign,
  buildQrTrackedUrl,
} from "@/lib/reputation/qr-campaigns";
import { getMaxActiveQrCampaigns, countActiveQrCampaigns } from "@/lib/reputation/qr-campaigns/limits";
import { buildGoogleReviewUrl } from "@/lib/reputation/review-requests";
import { getBusiness } from "@/lib/db/queries";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    const ensureDefault = url.searchParams.get("ensureDefault") === "1";

    if (ensureDefault) {
      const defaults = await getDefaultOrMigrateQrCampaign({
        organizationId: auth.organizationId,
        businessId,
        ownerUserId: auth.userId,
      });
      if (defaults) {
        return NextResponse.json({
          campaigns: [defaults],
          trackedUrl: buildQrTrackedUrl(defaults.shortCode),
        });
      }
    }

    const campaigns = await listQrCampaigns({
      organizationId: auth.organizationId,
      businessId,
      status: (url.searchParams.get("status") as "active" | "paused" | "all" | null) ?? "all",
      placementType: url.searchParams.get("placement") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });

    const [maxActive, activeCount] = await Promise.all([
      getMaxActiveQrCampaigns(auth.organizationId),
      countActiveQrCampaigns(auth.organizationId),
    ]);

    return NextResponse.json({
      campaigns,
      limits: { maxActive, activeCount },
      canCreateMore: activeCount < maxActive,
      advancedFormats: await hasEntitlement(auth.organizationId, "review_campaigns"),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list QR campaigns");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      name?: string;
      placementType?: string;
      customPlacementLabel?: string;
      destinationUrl?: string;
      placeId?: string;
      headline?: string;
      description?: string;
      brandColor?: string;
      printFormat?: "a4" | "a5" | "letter" | "qr_only";
      showFooter?: boolean;
      templateKey?: string;
      posterConfig?: Record<string, unknown>;
    };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(body.businessId);
    const rate = await assertRateLimit({
      key: `qr-campaign-create:${auth.organizationId}`,
      maxPerWindow: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many campaigns created." }, { status: 429 });
    }

    const business = await getBusiness(body.businessId, auth.organizationId);
    let destinationUrl = (body.destinationUrl ?? "").trim();
    if (!destinationUrl) {
      const placeId = (body.placeId ?? business?.place_id ?? "").trim();
      if (placeId) destinationUrl = buildGoogleReviewUrl(placeId);
    }
    if (!destinationUrl) {
      return NextResponse.json(
        { error: "Set a Google Place ID on the business or provide a review destination URL." },
        { status: 400 }
      );
    }

    const campaign = await createQrCampaign({
      organizationId: auth.organizationId,
      businessId: body.businessId,
      ownerUserId: auth.userId,
      name: body.name?.trim() || "QR Campaign",
      placementType: (body.placementType as never) ?? "standard_poster",
      customPlacementLabel: body.customPlacementLabel ?? null,
      destinationUrl,
      headline: body.headline,
      description: body.description,
      brandColor: body.brandColor,
      printFormat: body.printFormat,
      showFooter: body.showFooter,
      templateKey: body.templateKey,
      posterConfig: body.posterConfig as never,
      source: "app",
    });

    trackProductEvent("qr_campaign_created", {
      organizationId: auth.organizationId,
      businessId: body.businessId,
      campaignId: campaign.id,
    });

    return NextResponse.json({
      campaign,
      trackedUrl: buildQrTrackedUrl(campaign.shortCode),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create QR campaign");
  }
}
