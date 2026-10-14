import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  getNotificationSettings,
  upsertNotificationSettings,
} from "@/lib/reputation/review-alerts";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const settings = await getNotificationSettings(businessId);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const recipientsRaw = body.emailRecipients ?? body.email_recipients;
    const email_recipients = Array.isArray(recipientsRaw)
      ? recipientsRaw.map(String).map((e) => e.trim()).filter(Boolean)
      : typeof recipientsRaw === "string"
        ? recipientsRaw
            .split(/[,\n]/)
            .map((e: string) => e.trim())
            .filter(Boolean)
        : undefined;

    const settings = await upsertNotificationSettings({
      organizationId: auth.organizationId,
      businessId,
      settings: {
        every_new_review: body.everyNewReview ?? body.every_new_review,
        low_rating_only: body.lowRatingOnly ?? body.low_rating_only,
        unanswered_only: body.unansweredOnly ?? body.unanswered_only,
        daily_summary: body.dailySummary ?? body.daily_summary,
        weekly_summary: body.weeklySummary ?? body.weekly_summary,
        email_recipients,
        velocity_drop: body.velocityDrop ?? body.velocity_drop,
        competitor_velocity_spike:
          body.competitorVelocitySpike ?? body.competitor_velocity_spike,
        no_reviews_days: body.noReviewsDays ?? body.no_reviews_days,
        rating_changed: body.ratingChanged ?? body.rating_changed,
        response_overdue: body.responseOverdue ?? body.response_overdue,
        campaign_delivery_problem:
          body.campaignDeliveryProblem ?? body.campaign_delivery_problem,
        review_gap_widening: body.reviewGapWidening ?? body.review_gap_widening,
        maps_visibility_moved: body.mapsVisibilityMoved ?? body.maps_visibility_moved,
      },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed");
  }
}
