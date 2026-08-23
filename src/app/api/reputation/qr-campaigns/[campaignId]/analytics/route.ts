import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getQrCampaignAnalytics } from "@/lib/reputation/qr-campaigns";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { trackProductEvent } from "@/lib/analytics/product-events";

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
    const days = Number(url.searchParams.get("days") ?? "30");
    const analytics = await getQrCampaignAnalytics({
      campaignId,
      businessId,
      organizationId: auth.organizationId,
      days: Number.isFinite(days) ? days : 30,
    });
    trackProductEvent("qr_analytics_viewed", {
      organizationId: auth.organizationId,
      businessId,
      campaignId,
    });
    return NextResponse.json(analytics);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load QR analytics");
  }
}
