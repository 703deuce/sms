import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getPaymentQrEntitlements } from "@/lib/reputation/payment-qr/entitlements";
import { buildPaymentQrAnalyticsCsv } from "@/lib/reputation/payment-qr/export-csv";
import { getPaymentQrAnalytics } from "@/lib/reputation/payment-qr/service";
import { getQrCampaignForBusiness } from "@/lib/reputation/qr-campaigns";
import { httpErrorFromException } from "@/lib/security/http-errors";

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
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const days = Number(url.searchParams.get("days") ?? 30);
    const format = url.searchParams.get("format");

    if (format === "csv") {
      const entitlements = await getPaymentQrEntitlements(auth.organizationId);
      if (!entitlements.csvExport) {
        return NextResponse.json(
          { error: "Upgrade required to export payment QR analytics as CSV." },
          { status: 402 }
        );
      }
      const analytics = await getPaymentQrAnalytics(campaignId, days);
      const csv = buildPaymentQrAnalyticsCsv(analytics, {
        campaignName: campaign.name,
        days,
      });
      const filename = `payment-qr-${campaign.shortCode}-${days}d.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const analytics = await getPaymentQrAnalytics(campaignId, days);
    const entitlements = await getPaymentQrEntitlements(auth.organizationId);
    return NextResponse.json({ ...analytics, entitlements });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load payment analytics");
  }
}
